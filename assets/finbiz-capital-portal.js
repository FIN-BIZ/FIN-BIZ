import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const config = window.FINBIZ_SUPABASE_CONFIG;
const authForm = document.getElementById('capitalAuthForm');
const authStatus = document.getElementById('capitalAuthStatus');
const authPanel = document.getElementById('capitalAuthPanel');
const sessionPanel = document.getElementById('capitalSession');
const sessionEmail = document.getElementById('capitalSessionEmail');
const signOutButton = document.getElementById('capitalSignOut');
const applicationForm = document.getElementById('capitalLeadForm');
const applicationFields = document.getElementById('capitalApplicationFields');
const applicationStatus = document.getElementById('capitalApplicationStatus');
const fileInputs = Array.from(document.querySelectorAll('[data-document-category]'));
const uploadCount = document.getElementById('capitalUploadCount');
const uploadSize = document.getElementById('capitalUploadSize');
const categoryFileLists = Array.from(document.querySelectorAll('[data-category-files]'));
const MAX_FILE_COUNT = 30;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 200 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png']);
const DOCUMENT_CATEGORIES = new Set(['legal', 'financial', 'operational', 'collateral']);
const MIME_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png'
};

const setStatus = (element, message, isError = false) => {
  element.textContent = message;
  element.classList.toggle('form-status-error', isError);
};

const readableError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  const status = Number(error?.status);

  // Kiểm tra rate limit trước lỗi gửi email tổng quát.
  if (
    status === 429
    || code === 'over_email_send_rate_limit'
    || message.includes('rate limit')
    || message.includes('too many requests')
    || message.includes('only request this after')
  ) {
    return 'Yêu cầu gửi email đang bị giới hạn hoặc còn trong thời gian chờ. Đừng gửi lại liên tục; hãy đợi cooldown rồi thử một lần. Nếu vẫn lỗi, kiểm tra Authentication → Rate Limits và cấu hình Custom SMTP.';
  }

  if (
    code === 'email_address_not_authorized'
    || message.includes('email address not authorized')
  ) {
    return 'Máy chủ email chưa cho phép gửi tới địa chỉ này. Kiểm tra Custom SMTP và xác minh địa chỉ From; nếu dùng SMTP mặc định, email người nhận có thể không được hỗ trợ.';
  }

  if (message.includes('invalid login credentials')) {
    return 'Không thể xác thực email. Hãy dùng liên kết mới nhất trong hộp thư.';
  }

  if (
    message.includes('error sending confirmation email')
    || message.includes('error sending email')
    || message.includes('error sending magic link email')
  ) {
    return 'Supabase không gửi được email. Kiểm tra Authentication → SMTP Settings và xem Authentication → Logs để biết lỗi phía máy chủ email.';
  }

  return 'Không thể hoàn tất yêu cầu. Hãy kiểm tra Authentication → Logs hoặc thử lại sau.';
};

if (!(authForm instanceof HTMLFormElement)
  || !(authStatus instanceof HTMLElement)
  || !(authPanel instanceof HTMLElement)
  || !(sessionPanel instanceof HTMLElement)
  || !(sessionEmail instanceof HTMLElement)
  || !(signOutButton instanceof HTMLButtonElement)
  || !(applicationForm instanceof HTMLFormElement)
  || !(applicationFields instanceof HTMLFieldSetElement)
  || !(applicationStatus instanceof HTMLElement)
  || !fileInputs.length
  || fileInputs.some((input) => !(input instanceof HTMLInputElement))
  || !(uploadCount instanceof HTMLElement)
  || !(uploadSize instanceof HTMLElement)
  || categoryFileLists.length !== DOCUMENT_CATEGORIES.size) {
  throw new Error('Thiếu thành phần cần thiết trên trang Kết nối vốn.');
}

if (!config?.url || !config?.anonKey) {
  setStatus(authStatus, 'Cổng tải hồ sơ đang chờ cấu hình Supabase. Vui lòng liên hệ FINBIZ qua số 0358 608 830 trong thời gian thiết lập.', true);
  authForm.addEventListener('submit', (event) => {
    event.preventDefault();
    setStatus(authStatus, 'Cổng tải hồ sơ chưa được cấu hình. Vui lòng liên hệ FINBIZ qua số 0358 608 830.', true);
  });
} else {
  let supabase;
  try {
    const projectUrl = new URL(config.url);
    if (projectUrl.protocol !== 'https:') throw new Error('URL dự án Supabase phải sử dụng HTTPS.');
    supabase = createClient(projectUrl.origin, config.anonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
  } catch (error) {
    setStatus(authStatus, `Cấu hình Supabase không hợp lệ: ${readableError(error)}`, true);
  }

  if (!supabase) {
    authForm.addEventListener('submit', (event) => {
      event.preventDefault();
      setStatus(authStatus, 'Cổng tải hồ sơ chưa được cấu hình. Vui lòng liên hệ FINBIZ qua số 0358 608 830.', true);
    });
  }

  if (supabase) {
    setStatus(authStatus, 'Đang kết nối hệ thống lưu trữ bảo mật...');
    const setSession = (user) => {
      authForm.hidden = Boolean(user);
      sessionPanel.hidden = !user;
      applicationFields.disabled = !user;
      if (user) {
        sessionEmail.textContent = user.email || 'Email đã xác minh';
        setStatus(authStatus, '');
      } else {
        sessionEmail.textContent = '';
        setStatus(authStatus, 'Nhập email để nhận liên kết đăng nhập một lần.');
      }
    };

    authForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const emailInput = authForm.elements.namedItem('email');
      if (!(emailInput instanceof HTMLInputElement)) throw new Error('Thiếu trường email đăng nhập.');
      const button = authForm.querySelector('button[type="submit"]');
      if (!(button instanceof HTMLButtonElement)) throw new Error('Thiếu nút gửi liên kết đăng nhập.');

      button.disabled = true;
      setStatus(authStatus, 'Đang gửi liên kết xác minh...');
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: emailInput.value.trim(),
          options: { emailRedirectTo: window.location.href.split('#')[0] }
        });
        if (error) throw error;
        setStatus(authStatus, 'Đã gửi liên kết đăng nhập một lần. Hãy mở email trên thiết bị này để tiếp tục.');
      } catch (error) {
        console.error('Không gửi được liên kết đăng nhập FINBIZ:', error);
        setStatus(authStatus, `Không thể gửi liên kết đăng nhập: ${readableError(error)}`, true);
      } finally {
        button.disabled = false;
      }
    });

    signOutButton.addEventListener('click', async () => {
      signOutButton.disabled = true;
      const { error } = await supabase.auth.signOut();
      signOutButton.disabled = false;
      if (error) {
        console.error('Không thể đăng xuất khỏi cổng hồ sơ FINBIZ:', error);
        setStatus(authStatus, `Không thể đăng xuất: ${readableError(error)}`, true);
      } else {
        setStatus(authStatus, 'Đã đăng xuất khỏi cổng hồ sơ.');
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => setSession(session?.user || null));
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Không thể khôi phục phiên đăng nhập FINBIZ:', error);
        setStatus(authStatus, `Không thể khôi phục phiên đăng nhập: ${readableError(error)}`, true);
        return;
      }
      setSession(data.session?.user || null);
    });

    const renderSelectedFiles = () => {
      const selectedFiles = [];
      for (const input of fileInputs) {
        const category = input.dataset.documentCategory;
        if (!category || !DOCUMENT_CATEGORIES.has(category)) continue;
        const categoryList = categoryFileLists.find((list) => list.dataset.categoryFiles === category);
        if (!(categoryList instanceof HTMLElement)) throw new Error(`Thiếu danh sách tệp cho nhóm ${category}.`);
        categoryList.replaceChildren();
        Array.from(input.files || []).forEach((file, index) => {
          selectedFiles.push(file);
          const categoryItem = document.createElement('li');
          const fileName = document.createElement('span');
          const removeButton = document.createElement('button');
          fileName.textContent = file.name;
          removeButton.type = 'button';
          removeButton.className = 'capital-remove-file';
          removeButton.textContent = 'Xóa';
          removeButton.setAttribute('aria-label', `Xóa tệp ${file.name}`);
          removeButton.addEventListener('click', () => {
            const transfer = new DataTransfer();
            Array.from(input.files || []).forEach((selectedFile, selectedIndex) => {
              if (selectedIndex !== index) transfer.items.add(selectedFile);
            });
            input.files = transfer.files;
            renderSelectedFiles();
          });
          categoryItem.append(fileName, removeButton);
          categoryList.append(categoryItem);

        });
      }
      const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
      uploadCount.textContent = `${selectedFiles.length}/${MAX_FILE_COUNT} tệp đã chọn`;
      uploadSize.textContent = `${(totalSize / (1024 * 1024)).toFixed(2)} MB / 200 MB`;
    };
    fileInputs.forEach((input) => {
      input.addEventListener('change', renderSelectedFiles);
      const dropzone = input.closest('.capital-dropzone');
      if (!(dropzone instanceof HTMLElement)) throw new Error('Thiếu vùng tải tệp cho hồ sơ.');
      dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropzone.classList.add('is-dragging');
      });
      dropzone.addEventListener('dragleave', (event) => {
        if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-dragging');
      });
      dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-dragging');
        if (applicationFields.disabled || !event.dataTransfer?.files.length) return;
        const transfer = new DataTransfer();
        Array.from(input.files || []).concat(Array.from(event.dataTransfer.files)).forEach((file) => transfer.items.add(file));
        input.files = transfer.files;
        renderSelectedFiles();
      });
    });

    applicationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setStatus(applicationStatus, `Không xác minh được phiên đăng nhập: ${readableError(sessionError)}`, true);
        return;
      }
      const user = sessionData.session?.user;
      if (!user) {
        setStatus(applicationStatus, 'Vui lòng đăng nhập qua email trước khi gửi hồ sơ.', true);
        return;
      }

      const categorizedFiles = fileInputs.flatMap((input) => {
        const category = input.dataset.documentCategory;
        if (!category || !DOCUMENT_CATEGORIES.has(category)) return [];
        return Array.from(input.files || []).map((file) => ({ file, category }));
      });
      const files = categorizedFiles.map(({ file }) => file);
      if (!files.length || files.length > MAX_FILE_COUNT) {
        setStatus(applicationStatus, `Chọn từ 1 đến ${MAX_FILE_COUNT} tệp hồ sơ.`, true);
        return;
      }
      if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_FILE_SIZE) {
        setStatus(applicationStatus, 'Tổng dung lượng hồ sơ vượt quá 200 MB.', true);
        return;
      }
      const invalidFile = files.find((file) => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        return !extension || !ALLOWED_EXTENSIONS.has(extension) || file.size === 0 || file.size > MAX_FILE_SIZE;
      });
      if (invalidFile) {
        setStatus(applicationStatus, `Tệp "${invalidFile.name}" không đúng định dạng hoặc vượt quá 20 MB.`, true);
        return;
      }

      const submitButton = applicationForm.querySelector('button[type="submit"]');
      if (!(submitButton instanceof HTMLButtonElement)) throw new Error('Thiếu nút gửi hồ sơ.');
      submitButton.disabled = true;
      setStatus(applicationStatus, 'Đang lưu thông tin và tải hồ sơ lên kho riêng tư...');

      let applicationId;
      try {
        const formData = new FormData(applicationForm);
        const { data: application, error: applicationError } = await supabase
          .from('capital_applications')
          .insert({
            owner_id: user.id,
            business_type: String(formData.get('businessType') || ''),
            funding_need: String(formData.get('loanProduct') || ''),
            amount: String(formData.get('loanAmount') || ''),
            company: String(formData.get('company') || ''),
            representative: String(formData.get('fullname') || ''),
            phone: String(formData.get('phone') || ''),
            note: String(formData.get('note') || '')
          })
          .select('id')
          .single();
        if (applicationError) throw applicationError;
        applicationId = application.id;

        for (const [index, { file, category }] of categorizedFiles.entries()) {
          setStatus(applicationStatus, `Đang tải hồ sơ lên kho riêng tư (${index + 1}/${categorizedFiles.length}): ${file.name}`);
          const extension = file.name.split('.').pop().toLowerCase();
          const filePath = `${user.id}/${application.id}/${category}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from('capital-documents')
            .upload(filePath, file, { contentType: file.type || MIME_TYPES[extension], upsert: false });
          if (uploadError) throw uploadError;

          const { error: metadataError } = await supabase.from('capital_documents').insert({
            application_id: application.id,
            owner_id: user.id,
            document_type: category,
            file_path: filePath,
            file_name: file.name,
            mime_type: file.type || MIME_TYPES[extension],
            file_size: file.size
          });
          if (metadataError) throw metadataError;
        }

        setStatus(applicationStatus, `Đã gửi hồ sơ thành công. Mã tiếp nhận: ${application.id}. FINBIZ sẽ liên hệ theo thông tin bạn đã cung cấp.`);
        applicationForm.reset();
        renderSelectedFiles();
      } catch (error) {
        console.error('Không thể lưu hồ sơ kết nối vốn:', error);
        const partialMessage = applicationId
          ? `Thông tin đã tạo mã ${applicationId}, nhưng chưa thể xác nhận tải đủ tài liệu: `
          : 'Chưa thể lưu thông tin hồ sơ: ';
        setStatus(applicationStatus, `${partialMessage}${readableError(error)}. Vui lòng liên hệ 0358 608 830 để được hỗ trợ.`, true);
      } finally {
        submitButton.disabled = false;
      }
    });
  }
}