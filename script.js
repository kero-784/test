// --- GLOBALS ---
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzEkJ8yOTdmSIO1X3sXf2WzglTAZK3DINVTcpTQCaGaSJiS2pJgcY9I5fBxJpebYoa6/exec";

const state = { masterItemDatabase: [], currentUser: null, autocompleteDebounceTimer: null, notificationInterval: null, lastNotificationCheck: new Date().toISOString(), requestList: [], requests: [], lastUsedUnitCount: 1, lastUsedDiscount: 0, lastUsedVat: 0 };
const dom = {};

// --- API & AUTH ---
async function apiRequest(action, data = {}, showLoader = false) { if (showLoader) dom.loadingIndicator.style.display = 'flex'; try { const payload = { action, user: state.currentUser, data }; const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`Network error: ${response.statusText}`); const result = await response.json(); if (!result.success) throw new Error(result.error || `API error for action: ${action}`); return result; } catch (error) { console.error(`API Error (${action}):`, error); displayMessage(error.message, true); return { success: false, error: error.message }; } finally { if (showLoader) dom.loadingIndicator.style.display = 'none'; } }
async function handleLogin(event) {
    if (event) event.preventDefault();
    const loginCode = dom.loginCodeInput.value.trim();
    if (!loginCode) { showLoginError("Login Code is required."); return; }
    dom.loginError.style.display = 'none';
    try {
        const loginResult = await apiRequest('login', { loginCode }, true);
        if (!loginResult.success) throw new Error(loginResult.error);
        state.currentUser = loginResult.user;
        
        // Unlock audio context on first user interaction
        dom.notificationSound.muted = true;
        await dom.notificationSound.play().catch(e => {}); // Play and ignore errors
        dom.notificationSound.muted = false;

        const dbResult = await apiRequest('getItemDatabase', {}, true);
        if (dbResult.success) {
            state.masterItemDatabase = dbResult.data;
            sessionStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            initializeApp();
        } else {
            throw new Error("Could not load product database.");
        }
    } catch (error) {
        showLoginError(error.message);
        state.currentUser = null;
    }
}
async function initializeApp() { showView('main-view'); dom.welcomeMessage.textContent = `Welcome, ${state.currentUser.DisplayName} (${state.currentUser.Role})`; renderNav(); showMainAppView(); startNotificationPolling(); }
function handleLogout() { state.currentUser = null; sessionStorage.removeItem('currentUser'); if (state.notificationInterval) clearInterval(state.notificationInterval); showView('login-view'); dom.loginForm.reset(); state.requests = []; state.requestList = []; state.masterItemDatabase = []; dom.navButtons.innerHTML = ''; dom.appContentArea.innerHTML = ''; }

// --- NAVIGATION & VIEW MANAGEMENT ---
function renderNav() {
    let navHTML = `<button class="btn btn-sm btn-outline-primary active" id="nav-main-btn">Main App</button>`;
    if (['Admin', 'Officer'].includes(state.currentUser.Role)) {
        navHTML += `<button class="btn btn-sm btn-outline-secondary" id="nav-reports-btn">Reports</button>`;
    }
    if (state.currentUser.Role === 'Admin') {
        navHTML += `<button class="btn btn-sm btn-outline-danger" id="nav-admin-btn">User Management</button>`;
    }
    dom.navButtons.innerHTML = navHTML;
}
function showMainAppView() {
    let contentHTML = ``;
    if (['Branch', 'Officer'].includes(state.currentUser.Role)) {
        contentHTML = `
            <div id="main-app-content">
                ${state.currentUser.Role === 'Branch' ? `
                    <div id="branch-user-content">
                        <div class="card mb-3"><div class="card-header">Item Details & Pricing</div><div class="card-body"><form id="item-details-form"><div class="form-row"><div class="form-group col-md-6" style="position: relative;"><label for="code">Item Code</label><input type="text" class="form-control" id="code"><div id="autocomplete-suggestions" class="autocomplete-box"></div></div><div class="form-group col-md-6"><label for="type">Request Type</label><select class="form-control" id="type"><option value="شراء">شراء</option><option value="مرتجع">مرتجع</option></select></div></div><div class="form-group" id="currentPriceDiv" style="display:none;"><label for="currentPrice">Current Price</label><input type="number" step="0.001" class="form-control" id="currentPrice"></div><div class="form-group"><label for="name">Item Name</label><input type="text" class="form-control" id="name" readonly></div><div class="form-group"><label for="supplierName">Default Supplier</label><input type="text" class="form-control" id="supplierName" readonly></div><div class="form-group"><div class="form-check"><input type="checkbox" class="form-check-input" id="alternateSupplierCheck"><label class="form-check-label" for="alternateSupplierCheck">شراء من مورد اخر</label></div></div><div class="form-group" id="alternateSupplierDiv" style="display: none;"><label for="alternateSupplierName">Alternate Supplier Name</label><input type="text" class="form-control" id="alternateSupplierName"></div><hr><div class="form-group"><label for="unitPrice">Final Unit Price</label><div class="input-group"><input type="number" step="0.001" class="form-control" id="unitPrice"><div class="input-group-append"><button class="btn btn-outline-secondary" type="button" id="calc-btn" title="Calculate from Case Cost"><i class="fas fa-calculator"></i></button></div></div></div><button type="button" class="btn btn-success" id="add-to-list-btn"><i class="fas fa-plus"></i> Add Item</button></form></div></div>
                        <div id="submission-list-card" class="card mb-3" style="display:none;"><div class="card-header">Pending Items</div><div class="card-body"><div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Code</th><th>Name</th><th>Supplier</th><th>Units</th><th>Disc.</th><th>VAT</th><th>Piece</th><th>Case</th><th>Actions</th></tr></thead><tbody id="submission-list-tbody"></tbody></table></div><hr><div class="d-flex justify-content-between"><button class="btn btn-danger" id="clear-list-btn"><i class="fas fa-trash"></i> Clear</button><button class="btn btn-primary" id="submit-all-btn"><i class="fas fa-paper-plane"></i> Submit</button></div></div></div>
                        <div class="card"><div class="card-header">My Submission History <button class="btn btn-sm btn-outline-secondary toggle-history-btn"><i class="fas fa-eye"></i> Show</button></div><div class="card-body table-responsive p-0" id="branch-history-container" style="display:none;"><table id="branch-requests-table" class="table table-hover mb-0"><thead><tr><th>ID</th><th>Date</th><th>Status</th></tr></thead><tbody></tbody></table></div></div>
                    </div>` : ''}
                ${state.currentUser.Role === 'Officer' ? `
                    <div id="officer-content">
                        <div class="card"><div class="card-header">All Price Update Requests</div><div class="card-body table-responsive p-0"><table id="officer-requests-table" class="table table-hover mb-0"><thead><tr><th>ID</th><th>Date</th><th>Branch</th><th>By</th><th>Status</th><th>Actions</th></tr></thead><tbody></tbody></table></div></div>
                    </div>` : ''}
            </div>`;
    }
    dom.appContentArea.innerHTML = contentHTML;
    cacheAppDOMElements();
    loadAndRenderRequests();
}
async function showAdminView() {
    const contentHTML = `
        <div id="admin-view">
            <div class="card"><div class="card-header">User Management</div><div class="card-body">
                <div class="admin-actions"><button class="btn btn-success" id="add-user-btn"><i class="fas fa-plus"></i> Add New User</button></div>
                <div class="table-responsive"><table class="table table-striped"><thead><tr><th>Login Code</th><th>Display Name</th><th>Role</th><th>Branch</th><th>Actions</th></tr></thead><tbody id="users-table-tbody"></tbody></table></div>
            </div></div>
        </div>`;
    dom.appContentArea.innerHTML = contentHTML;
    const usersResult = await apiRequest('getUsers', {}, true);
    if(usersResult.success) renderUsersTable(usersResult.data);
}
async function showReportsView() {
    const contentHTML = `
        <div id="reports-view">
            <div class="card"><div class="card-header">Activity Log Report</div><div class="card-body">
                <div class="filter-controls row align-items-end">
                    <div class="form-group col-md-3"><label>Start Date</label><input type="date" id="report-start-date" class="form-control"></div>
                    <div class="form-group col-md-3"><label>End Date</label><input type="date" id="report-end-date" class="form-control"></div>
                    <div class="form-group col-md-3"><label>User</label><select id="report-user-filter" class="form-control"><option value="">All Users</option></select></div>
                    <div class="form-group col-md-3"><label>Action</label><select id="report-action-filter" class="form-control"><option value="">All Actions</option></select></div>
                    <div class="col-12 text-right"><button class="btn btn-primary" id="generate-report-btn"><i class="fas fa-sync-alt"></i> Generate Report</button></div>
                </div>
                <div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead><tbody id="report-results-tbody"></tbody></table></div>
            </div></div>
        </div>`;
    dom.appContentArea.innerHTML = contentHTML;
    populateReportFilters();
}

// --- DATA LOADING & RENDERING ---
async function loadAndRenderRequests(showLoader = false) { const result = await apiRequest('getRequests', {}, showLoader); if (result.success) { state.requests = result.data; renderRequests(); } }
function renderRequests() { if (!state.currentUser) return; if (state.currentUser.Role === 'Officer') renderOfficerRequests(state.requests); else if (state.currentUser.Role === 'Branch') renderBranchRequests(state.requests); }
function renderBranchRequests(requests) { const tbody = document.getElementById('branch-requests-table').querySelector('tbody'); if (!requests || requests.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4">No submission history.</td></tr>'; return; } tbody.innerHTML = requests.map(r => { const { badgeClass, statusText } = getStatusSummary(r); return `<tr data-request-id="${r.RequestID}" style="cursor: pointer;"><td>${r.RequestID}</td><td>${new Date(r.SubmissionTimestamp).toLocaleDateString()}</td><td><span class="badge ${badgeClass}">${statusText}</span></td></tr>`; }).join(''); }
function renderOfficerRequests(requests) { const tbody = document.getElementById('officer-requests-table').querySelector('tbody'); if (!requests || requests.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No requests found.</td></tr>'; return; } tbody.innerHTML = requests.map(r => { const { badgeClass, statusText } = getStatusSummary(r); const isResponded = !!r.OfficerResponseTimestamp; return `<tr class="${isResponded ? 'table-light text-muted' : ''}"><td>${r.RequestID}</td><td>${new Date(r.SubmissionTimestamp).toLocaleDateString()}</td><td>${r.Branch}</td><td>${r.SubmittedBy}</td><td><span class="badge ${badgeClass}">${statusText}</span></td><td><button class="btn btn-sm btn-primary review-btn" data-request-id="${r.RequestID}"><i class="fas fa-search"></i> ${isResponded ? 'View' : 'Review'}</button></td></tr>`; }).join(''); }

// --- USER MANAGEMENT (Admin) ---
function renderUsersTable(users) { const tbody = document.getElementById('users-table-tbody'); tbody.innerHTML = users.map(u => `<tr><td>${u.LoginCode}</td><td>${u.DisplayName}</td><td>${u.Role}</td><td>${u.Branch}</td><td><button class="btn btn-sm btn-info edit-user-btn" data-user='${JSON.stringify(u)}'><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger delete-user-btn" data-logincode="${u.LoginCode}"><i class="fas fa-trash"></i></button></td></tr>`).join(''); }
function openUserModal(user = null) { dom.userForm.reset(); if(user) { dom.userModalTitle.textContent = "Edit User"; dom.userFormOriginalLoginCode.value = user.LoginCode; dom.userLoginCode.value = user.LoginCode; dom.userLoginCode.readOnly = true; dom.userDisplayName.value = user.DisplayName; dom.userRole.value = user.Role; dom.userBranch.value = user.Branch; } else { dom.userModalTitle.textContent = "Add User"; dom.userFormOriginalLoginCode.value = ''; dom.userLoginCode.readOnly = false; } $('#user-modal').modal('show'); }
async function saveUser() { const isEditing = !!dom.userFormOriginalLoginCode.value; const userData = { LoginCode: dom.userLoginCode.value.trim(), DisplayName: dom.userDisplayName.value.trim(), Role: dom.userRole.value, Branch: dom.userBranch.value, originalLoginCode: dom.userFormOriginalLoginCode.value }; if(!userData.LoginCode || !userData.DisplayName) { displayMessage("Login Code and Display Name are required.", true); return; } const action = isEditing ? 'updateUser' : 'addUser'; const result = await apiRequest(action, userData, true); if(result.success) { displayMessage(result.message); $('#user-modal').modal('hide'); await showAdminView(); } }
async function deleteUser(loginCode) { if(loginCode === state.currentUser.LoginCode) { displayMessage("You cannot delete your own account.", true); return; } if(confirm(`Are you sure you want to delete user ${loginCode}? This cannot be undone.`)) { const result = await apiRequest('deleteUser', { LoginCode: loginCode }, true); if(result.success) { displayMessage(result.message); await showAdminView(); } } }

// --- REPORTING ---
async function populateReportFilters() { const usersResult = await apiRequest('getUsers'); if(usersResult.success) { const userFilter = document.getElementById('report-user-filter'); usersResult.data.forEach(u => userFilter.innerHTML += `<option value="${u.LoginCode}">${u.DisplayName}</option>`); } const actions = ['LOGIN_SUCCESS', 'LOGIN_FAIL', 'SUBMIT_BATCH_REQUEST', 'UPDATE_ITEM_STATUS', 'FINALIZE_FOR_BRANCH', 'CONFIRM_RECEIPT']; const actionFilter = document.getElementById('report-action-filter'); actions.forEach(a => actionFilter.innerHTML += `<option>${a}</option>`); }
async function generateActivityReport() { const filters = { startDate: document.getElementById('report-start-date').value, endDate: document.getElementById('report-end-date').value, user: document.getElementById('report-user-filter').value, action: document.getElementById('report-action-filter').value }; const result = await apiRequest('getFilteredLogs', filters, true); if(result.success) renderActivityLogTable(result.data); }
function renderActivityLogTable(logs) { const tbody = document.getElementById('report-results-tbody'); if(!logs || logs.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No logs found for the selected criteria.</td></tr>'; return; } tbody.innerHTML = logs.map(log => `<tr><td>${new Date(log.Timestamp).toLocaleString()}</td><td>${log.Username}</td><td>${log.Role}</td><td><span class="badge badge-light">${log.Action}</span></td><td>${log.Details}</td></tr>`).join(''); }

// --- OFFICER MODAL ---
function renderOfficerModal(items) {
    const tbody = document.getElementById('modal-items-tbody');
    tbody.innerHTML = items.map(item => {
        return `
        <tr data-item-id="${item.ItemID}">
            <td>${item.ItemCode}</td><td>${item.ItemName}</td>
            <td><span class="badge badge-pill badge-light">${item.RequestType || 'N/A'}</span></td>
            <td>${item.SubmittedSupplier}</td><td>${item.CurrentPrice || '0'}</td>
            <td>${item.SubmittedPiecePrice}</td>
            <td><select class="form-control form-control-sm item-status-select"><option ${item.Status === 'Pending' ? 'selected' : ''}>Pending</option><option>تم التعديل</option><option>غير مسموع بالتعديل ويتم رفع الصنف</option><option>تم التعديل جزئيا</option><option>يرجي مراجعة كود الاستثناء</option><option>يتم المراجعة مع المورد</option></select></td>
        </tr>`
    }).join('');
}
async function saveItemChanges() { /* unchanged */ }
async function finalizeForBranch() { /* unchanged */ }
async function confirmReceipt() { /* unchanged */ }

// --- BRANCH FORM ---
function addToList() { const code = dom.codeInput.value.trim(); const unitPrice = dom.unitPriceInput.value; if (!code || !unitPrice) { displayMessage("Code and Final Unit Price are required.", true); return; } const alternateSupplierName = dom.alternateSupplierNameInput.value.trim(); let supplier = dom.alternateSupplierCheck.checked && alternateSupplierName ? alternateSupplierName : dom.supplierNameInput.value.trim(); const finalUnitPrice = parseFloat(unitPrice); const newItem = { code: code, name: dom.nameInput.value.trim(), supplier: supplier, units: state.lastUsedUnitCount, discount: state.lastUsedDiscount, vat: state.lastUsedVat, piece: finalUnitPrice.toFixed(3), case: (finalUnitPrice * state.lastUsedUnitCount).toFixed(3), type: dom.typeSelect.value, current: dom.currentPriceInput.value || '0' }; state.requestList.push(newItem); displayMessage("Item added to list.", false, 1500); clearRequestForm(); renderRequestListTable(); }

// --- UTILITIES & STARTUP ---
function getStatusSummary(request) { if (request.BranchConfirmTimestamp) return { badgeClass: 'badge-success', statusText: `✅ Confirmed` }; if (request.OfficerResponseTimestamp) return { badgeClass: 'badge-primary', statusText: `🔵 Awaiting Confirmation` }; if (request.itemsPending === 0 && request.itemsTotal > 0) return { badgeClass: 'badge-secondary', statusText: `☑️ Processed` }; return { badgeClass: 'badge-info', statusText: `⚠️ ${request.itemsPending} / ${request.itemsTotal} Pending` }; }
function startNotificationPolling() { /* unchanged */ }
function showFullscreenNotification(event) { dom.fullscreenNotificationOkBtn.dataset.requestId = event.requestID; $('#fullscreen-notification-modal').modal('show'); }
function displayMessage(message, isError = false, duration = 4000) { const toastContainer = document.getElementById('toast-container'); /* ... rest is unchanged ... */ const toastElement = document.getElementById(toastId); $(toastElement).toast({ delay: duration, autohide: true }); }

function cacheDOMElements() {
    dom.loginView = document.getElementById('login-view');
    dom.mainView = document.getElementById('main-view');
    dom.loginForm = document.getElementById('login-form');
    dom.loginCodeInput = document.getElementById('loginCode');
    dom.loginError = document.getElementById('login-error');
    dom.loadingIndicator = document.getElementById('loading-indicator');
    dom.welcomeMessage = document.getElementById('welcome-message');
    dom.logoutBtn = document.getElementById('logout-btn');
    dom.toastContainer = document.getElementById('toast-container');
    dom.notificationSound = document.getElementById('notification-sound');
    dom.navButtons = document.getElementById('nav-buttons');
    dom.appContentArea = document.getElementById('app-content-area');
    // Modals
    dom.userForm = document.getElementById('user-form');
    dom.userModalTitle = document.getElementById('user-modal-title');
    dom.userFormOriginalLoginCode = document.getElementById('user-form-original-logincode');
    dom.userLoginCode = document.getElementById('user-logincode');
    dom.userDisplayName = document.getElementById('user-displayname');
    dom.userRole = document.getElementById('user-role');
    dom.userBranch = document.getElementById('user-branch');
    dom.fullscreenNotificationOkBtn = document.getElementById('fullscreen-notification-ok-btn');
}
function cacheAppDOMElements() {
    // Caches elements that are created dynamically after a view is shown
    if (state.currentUser.Role === 'Branch') {
        dom.itemDetailsForm = document.getElementById('item-details-form');
        dom.codeInput = document.getElementById('code');
        // ... cache all other branch form elements ...
    }
}
function setupEventListeners() {
    dom.loginForm.addEventListener('submit', handleLogin);
    dom.logoutBtn.addEventListener('click', handleLogout);
    
    document.body.addEventListener('click', (e) => {
        // Nav
        if(e.target.id === 'nav-main-btn') { setActiveNav(e.target); showMainAppView(); }
        if(e.target.id === 'nav-reports-btn') { setActiveNav(e.target); showReportsView(); }
        if(e.target.id === 'nav-admin-btn') { setActiveNav(e.target); showAdminView(); }

        // Admin
        if(e.target.id === 'add-user-btn') openUserModal();
        if(e.target.id === 'save-user-btn') saveUser();
        if(e.target.matches('.edit-user-btn, .edit-user-btn *')) { openUserModal(JSON.parse(e.target.closest('.edit-user-btn').dataset.user)); }
        if(e.target.matches('.delete-user-btn, .delete-user-btn *')) { deleteUser(e.target.closest('.delete-user-btn').dataset.logincode); }
        
        // Reports
        if(e.target.id === 'generate-report-btn') generateActivityReport();

        // History Toggle
        if (e.target.matches('.toggle-history-btn, .toggle-history-btn *')) {
            const btn = e.target.closest('.toggle-history-btn');
            const container = btn.closest('.card-header').nextElementSibling;
            const isVisible = container.style.display !== 'none';
            container.style.display = isVisible ? 'none' : 'block';
            btn.innerHTML = isVisible ? '<i class="fas fa-eye"></i> Show' : '<i class="fas fa-eye-slash"></i> Hide';
        }

        // Branch Actions
        const branchContent = document.getElementById('branch-user-content');
        if (branchContent && branchContent.contains(e.target)) {
            // ... all branch-specific event listeners ...
        }

        // Modals
        if (e.target.id === 'finalize-for-branch-btn') finalizeForBranch();
        if (e.target.id === 'confirm-receipt-btn') confirmReceipt();
        if (e.target.id === 'fullscreen-notification-ok-btn') { const requestId = e.target.dataset.requestId; $('#fullscreen-notification-modal').modal('hide'); if (requestId) { viewRequestDetails(requestId); } }
    });
}
function setActiveNav(clickedButton) { dom.navButtons.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active')); clickedButton.classList.add('active'); }
document.addEventListener('DOMContentLoaded', function() { cacheDOMElements(); setupEventListeners(); const storedUser = sessionStorage.getItem('currentUser'); if (storedUser) { state.currentUser = JSON.parse(storedUser); const loginCode = state.currentUser.LoginCode; dom.loginCodeInput.value = loginCode; handleLogin(); } else { showView('login-view'); } });
