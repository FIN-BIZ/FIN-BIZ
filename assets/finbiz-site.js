(() => {
  const scriptUrl = 'https://script.google.com/macros/s/AKfycbyDpPo7MAeMwfa-Akxd2AGtAGNnVsZuDmGcSKF8hr12M8GoxdoNYmRZHG2IHcyYkhe7Bw/exec';

  window.toggleFinbizMenu = (button) => {
    const menu = document.getElementById('main-menu');
    if (!menu) return;
    const isOpen = menu.classList.toggle('mobile-open');
    button?.setAttribute('aria-expanded', String(isOpen));
    button?.setAttribute('aria-label', isOpen ? 'Đóng menu' : 'Mở menu');
  };

  const navLinks = document.querySelector('.nav-links');
  const brand = document.querySelector('.nav .brand');
  if (navLinks && brand && !navLinks.querySelector('[data-capital-portal-link]')) {
    const portalUrl = new URL('ket-noi-von.html', new URL(brand.getAttribute('href'), window.location.href));
    const portalLink = document.createElement('a');
    portalLink.href = portalUrl.href;
    portalLink.textContent = 'Kết nối vốn';
    portalLink.dataset.capitalPortalLink = '';

    if (window.location.pathname === portalUrl.pathname) {
      portalLink.classList.add('active');
      portalLink.setAttribute('aria-current', 'page');
    }

    const navActions = navLinks.querySelector('.nav-actions');
    const navCta = navLinks.querySelector('.nav-cta');
    const insertionPoint = navActions || navCta;
    if (insertionPoint) insertionPoint.before(portalLink);
    else navLinks.append(portalLink);
  }

  window.submitFinbizLead = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector('[data-form-status]');
    if (!(button instanceof HTMLButtonElement) || !(status instanceof HTMLElement)) {
      throw new Error('Thiếu nút gửi hoặc vùng thông báo trạng thái của biểu mẫu FIN BIZ.');
    }

    const originalText = button.textContent;
    const formData = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ['businessType', 'loanProduct', 'loanAmount', 'fullname', 'phone', 'company', 'note']) {
      params.set(key, String(formData.get(key) ?? ''));
    }

    button.disabled = true;
    button.textContent = 'Đang gửi yêu cầu...';
    status.textContent = 'Đang gửi thông tin của bạn.';
    status.classList.remove('form-status-error');

    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: params
      });
      status.textContent = 'Đã gửi yêu cầu đến hệ thống tiếp nhận. Trình duyệt không cho website đọc xác nhận từ Google Apps Script, nên chưa thể xác nhận dữ liệu đã được ghi vào Google Sheets. Nếu chưa được liên hệ, vui lòng gọi 0358 608 830.';
    } catch (error) {
      console.error('Không gửi được yêu cầu tư vấn FIN BIZ:', error);
      status.textContent = 'Không thể kết nối hệ thống tiếp nhận. Thông tin chưa được xác nhận; vui lòng thử lại hoặc gọi 0358 608 830.';
      status.classList.add('form-status-error');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  };
})();
