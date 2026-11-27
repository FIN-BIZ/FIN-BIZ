import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const config = window.FINBIZ_SUPABASE_CONFIG;
const authForm = document.getElementById('capitalAuthForm');
const authStatus = document.getElementById('capitalAuthStatus');
const authPanel = document.getElementById('capitalAuthPanel');
const dashboard = document.getElementById('capitalDashboard');
const applicationsList = document.getElementById('capitalApplicationsList');
const applicationCount = document.getElementById('capitalApplicationCount');
const newApplicationButton = document.getElementById('capitalNewApplication');
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
  || !(dashboard instanceof HTMLElement)
  || !(applicationsList instanceof HTMLElement)
  || !(applicationCount instanceof HTMLElement)
  || !(newApplicationButton instanceof HTMLButtonElement)
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
    let dashboardRequest = 0;
    const formatDate = (value) => new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
    const formatSize = (value) => value < 1024 * 1024
      ? `${Math.max(1, Math.round(value / 1024))} KB`
      : `${(value / (1024 * 1024)).toFixed(2)} MB`;
    const statusDetails = {
      received: { label: 'Đã tiếp nhận', detail: 'FINBIZ đã nhận thông tin và tài liệu của bạn.', step: 0 },
      reviewing: { label: 'Đang rà soát', detail: 'Hồ sơ đang được FINBIZ xem xét.', step: 1 },
      contacted: { label: 'Đã liên hệ', detail: 'FINBIZ đã cập nhật trao đổi với doanh nghiệp.', step: 2 },
      closed: { label: 'Đã kết thúc', detail: 'FINBIZ đã kết thúc xử lý hồ sơ này.', step: 2 }
    };
    const categoryNames = {
      legal: 'Pháp lý',
      financial: 'Tài chính',
      operational: 'Hoạt động',
      collateral: 'Tài sản bảo đảm',
      other: 'Khác'
    };
    const appendText = (parent, tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      element.textContent = text;
      parent.append(element);
      return element;
    };
    const renderApplications = (applications, documents) => {
      applicationsList.replaceChildren();
      applicationCount.textContent = `${applications.length} hồ sơ`;
      for (const application of applications) {
        const appDocuments = documents.filter((document) => document.application_id === application.id);
        const status = statusDetails[application.status];
        if (!status) throw new Error(`Trạng thái hồ sơ không được hỗ trợ: ${application.status}`);
        const card = document.createElement('article');
        card.className = 'capital-application-card';

        const header = document.createElement('div');
        header.className = 'capital-application-card-head';
        const identity = document.createElement('div');
        appendText(identity, 'h4', '', application.company);
        appendText(identity, 'p', 'capital-application-card-meta', `Mã hồ sơ ${application.id} · Gửi ${formatDate(application.created_at)}`);
        const badge = appendText(header, 'span', 'capital-status-badge', status.label);
        if (application.status === 'closed') badge.classList.add('is-neutral');
        header.prepend(identity);
        card.append(header);
        appendText(card, 'p', 'capital-application-status-copy', status.detail);

        const facts = document.createElement('dl');
        facts.className = 'capital-application-facts';
        const factItems = [
          ['Nhu cầu vốn', application.funding_need],
          ['Số vốn dự kiến', application.amount],
          ['Mô hình', application.business_type],
          ['Giấy tờ đã nộp', `${appDocuments.length} tệp`]
        ];
        for (const [label, value] of factItems) {
          const fact = document.createElement('div');
          appendText(fact, 'dt', '', label);
          appendText(fact, 'dd', '', value);
          facts.append(fact);
        }
        card.append(facts);

        const progress = document.createElement('ol');
        progress.className = 'capital-application-progress';
        const progressSteps = ['Đã gửi', 'FINBIZ rà soát', 'Trao đổi cùng doanh nghiệp'];
        progressSteps.forEach((label, index) => {
          const item = document.createElement('li');
          if (index < status.step) item.classList.add('is-complete');
          if (index === status.step) item.classList.add('is-current');
          appendText(item, 'span', 'capital-progress-marker', index < status.step ? '✓' : String(index + 1));
          appendText(item, 'span', 'capital-progress-label', label);
          progress.append(item);
        });
        card.append(progress);

        const history = document.createElement('details');
        history.className = 'capital-document-history';
        const summary = document.createElement('summary');
        summary.textContent = `Giấy tờ đã nộp (${appDocuments.length})`;
        history.append(summary);
        if (appDocuments.length) {
          const list = document.createElement('ul');
          for (const document of appDocuments) {
            const item = document.createElement('li');
            appendText(item, 'span', '', `${categoryNames[document.document_type] || 'Hồ sơ'} · ${document.file_name}`);
            appendText(item, 'span', '', formatDate(document.created_at));
            list.append(item);
          }
          history.append(list);
        } else {
          appendText(history, 'p', 'capital-dashboard-status', 'Chưa có giấy tờ được ghi nhận.');
        }
        card.append(history);

        const supplementForm = document.createElement('form');
        supplementForm.className = 'capital-supplement';
        supplementForm.dataset.applicationId = application.id;
        const categoryLabel = document.createElement('label');
        categoryLabel.textContent = 'Nhóm giấy tờ';
        const categoryInput = document.createElement('select');
        categoryInput.name = 'category';
        categoryInput.required = true;
        for (const [value, label] of Object.entries(categoryNames).filter(([value]) => value !== 'other')) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          categoryInput.append(option);
        }
        categoryLabel.append(categoryInput);
        const filesLabel = document.createElement('label');
        filesLabel.textContent = 'Chọn giấy tờ bổ sung';
        const filesInput = document.createElement('input');
        filesInput.name = 'files';
        filesInput.type = 'file';
        filesInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';
        filesInput.multiple = true;
        filesInput.required = true;
        filesLabel.append(filesInput);
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.textContent = 'Bổ sung giấy tờ';
        supplementForm.append(categoryLabel, filesLabel, submit);
        card.append(supplementForm);
        const supplementStatus = document.createElement('p');
        supplementStatus.className = 'capital-dashboard-status';
        supplementStatus.setAttribute('role', 'status');
        supplementStatus.setAttribute('aria-live', 'polite');
        card.append(supplementStatus);
        applicationsList.append(card);
      }
    };
    const refreshDashboard = async (user) => {
      const request = ++dashboardRequest;
      setStatus(authStatus, 'Đang tải hồ sơ của bạn...');
      const { data: applications, error: applicationsError } = await supabase
        .from('capital_applications')
        .select('id, company, business_type, funding_need, amount, status, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (applicationsError) throw applicationsError;
      if (request !== dashboardRequest) return;
      if (!applications.length) {
        dashboard.hidden = true;
        applicationForm.hidden = false;
        applicationsList.replaceChildren();
        applicationCount.textContent = '';
        setStatus(authStatus, '');
        return;
      }
      const { data: documents, error: documentsError } = await supabase
        .from('capital_documents')
        .select('application_id, document_type, file_name, file_size, created_at')
        .in('application_id', applications.map((application) => application.id))
        .order('created_at', { ascending: false });
      if (documentsError) throw documentsError;
      if (request !== dashboardRequest) return;
      renderApplications(applications, documents);
      dashboard.hidden = false;
      applicationForm.hidden = true;
      setStatus(authStatus, '');
    };
    newApplicationButton.addEventListener('click', () => {
      dashboard.hidden = true;
      applicationForm.hidden = false;
      applicationForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const setSession = (user) => {
      authForm.hidden = Boolean(user);
      sessionPanel.hidden = !user;
      applicationFields.disabled = !user;
      if (user) {
        sessionEmail.textContent = user.email || 'Email đã xác minh';
        dashboard.hidden = true;
        applicationForm.hidden = true;
        refreshDashboard(user).catch((error) => {
          console.error('Không thể tải hồ sơ FINBIZ:', error);
          dashboard.hidden = true;
          applicationForm.hidden = false;
          setStatus(authStatus, `Không thể tải hồ sơ: ${readableError(error)}`, true);
        });
      } else {
        dashboardRequest += 1;
        dashboard.hidden = true;
        applicationForm.hidden = false;
        applicationsList.replaceChildren();
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

    dashboard.addEventListener('submit', async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.classList.contains('capital-supplement')) return;
      event.preventDefault();
      const status = form.nextElementSibling;
      const categoryInput = form.elements.namedItem('category');
      const filesInput = form.elements.namedItem('files');
      const submit = form.querySelector('button[type="submit"]');
      if (!(status instanceof HTMLElement)
        || !(categoryInput instanceof HTMLSelectElement)
        || !(filesInput instanceof HTMLInputElement)
        || !(submit instanceof HTMLButtonElement)) {
        throw new Error('Thiếu thành phần tải giấy tờ bổ sung.');
      }
      const files = Array.from(filesInput.files || []);
      if (!files.length || files.length > MAX_FILE_COUNT) {
        setStatus(status, `Chọn từ 1 đến ${MAX_FILE_COUNT} tệp.`, true);
        return;
      }
      if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_FILE_SIZE) {
        setStatus(status, 'Tổng dung lượng giấy tờ vượt quá 200 MB.', true);
        return;
      }
      const invalidFile = files.find((file) => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        return !extension || !ALLOWED_EXTENSIONS.has(extension) || file.size === 0 || file.size > MAX_FILE_SIZE;
      });
      if (invalidFile) {
        setStatus(status, `Tệp "${invalidFile.name}" không đúng định dạng hoặc vượt quá 20 MB.`, true);
        return;
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        setStatus(status, `Phiên đăng nhập không hợp lệ. ${sessionError ? readableError(sessionError) : 'Vui lòng đăng nhập lại.'}`, true);
        return;
      }

      const user = sessionData.session.user;
      const applicationId = form.dataset.applicationId;
      const category = categoryInput.value;
      let uploaded = 0;
      submit.disabled = true;
      try {
        for (const file of files) {
          setStatus(status, `Đang bổ sung giấy tờ (${uploaded + 1}/${files.length}): ${file.name}`);
          const extension = file.name.split('.').pop().toLowerCase();
          const filePath = `${user.id}/${applicationId}/${category}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from('capital-documents')
            .upload(filePath, file, { contentType: file.type || MIME_TYPES[extension], upsert: false });
          if (uploadError) throw uploadError;
          const { error: metadataError } = await supabase.from('capital_documents').insert({
            application_id: applicationId,
            owner_id: user.id,
            document_type: category,
            file_path: filePath,
            file_name: file.name,
            mime_type: file.type || MIME_TYPES[extension],
            file_size: file.size
          });
          if (metadataError) throw metadataError;
          uploaded += 1;
        }
        setStatus(status, `Đã bổ sung ${uploaded} giấy tờ vào hồ sơ.`);
        form.reset();
        await refreshDashboard(user);
      } catch (error) {
        console.error('Không thể bổ sung giấy tờ hồ sơ FINBIZ:', error);
        const partial = uploaded ? `Đã lưu ${uploaded}/${files.length} tệp. ` : '';
        setStatus(status, `${partial}Không thể bổ sung giấy tờ: ${readableError(error)}`, true);
      } finally {
        submit.disabled = false;
      }
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
        await refreshDashboard(user);
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