// PART 1 OF 4: CORE SETUP & API
window.printReport = function(elementId) {
    const reportContent = document.querySelector(`#${elementId} .printable-document`);
    if (reportContent) {
        document.getElementById('print-area').innerHTML = reportContent.outerHTML;
        setTimeout(() => window.print(), 100);
    } else {
        console.error(`Could not find content to print in #${elementId}`);
        alert("Error: Report content not found.");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // !!! IMPORTANT: PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw6ILWFJPd8gsFQY-h4ZVZSByQfSXIzl6OpKk2m488Ihu9u1TCFSxsWAjvkW5Ws65NU/exec';

    const Logger = {
        info: (message, ...args) => console.log(`[StockWise INFO] ${message}`, ...args),
        warn: (message, ...args) => console.warn(`[StockWise WARN] ${message}`, ...args),
        error: (message, ...args) => console.error(`[StockWise ERROR] ${message}`, ...args),
        debug: (message, ...args) => {
            if (state.currentUser && state.currentUser.RoleName === 'Admin') {
                showToast(`DEBUG: ${message}`, 'info');
            }
            console.log(`[StockWise DEBUG] ${message}`, ...args);
        }
    };

    let state = {
        currentUser: null,
        username: null,
        loginCode: null,
        items: [],
        suppliers: [],
        branches: [],
        sections: [],
        transactions: [],
        payments: [],
        purchaseOrders: [],
        purchaseOrderItems: [],
        itemRequests: [],
        activityLog: [],
        currentReceiveList: [],
        currentTransferList: [],
        currentIssueList: [],
        currentPOList: [],
        currentReturnList: [],
        currentRequestList: [],
        currentEditingPOList: [],
        currentAdjustmentList: [],
        modalSelections: new Set(),
        invoiceModalSelections: new Set(),
        allUsers: [],
        allRoles: [],
        backups: []
    };
    let modalContext = null;

    const userCan = (permission) => {
        if (!state.currentUser || !state.currentUser.permissions) return false;
        const p = state.currentUser.permissions[permission];
        return p === true || String(p).toUpperCase() === 'TRUE';
    };

    // --- DOM ELEMENT REFERENCES ---
    const loginContainer = document.getElementById('login-container');
    const loginForm = document.getElementById('login-form');
    const loginUsernameInput = document.getElementById('login-username');
    const loginCodeInput = document.getElementById('login-code');
    const loginError = document.getElementById('login-error');
    const loginLoader = document.getElementById('login-loader');
    const appContainer = document.getElementById('app-container');
    const btnLogout = document.getElementById('btn-logout');
    const globalRefreshBtn = document.getElementById('global-refresh-button');
    const mainContent = document.querySelector('.main-content');

    const itemSelectorModal = document.getElementById('item-selector-modal');
    const invoiceSelectorModal = document.getElementById('invoice-selector-modal');
    const editModal = document.getElementById('edit-modal');
    const historyModal = document.getElementById('history-modal');
    const editPOModal = document.getElementById('edit-po-modal');
    const approveRequestModal = document.getElementById('approve-request-modal');
    
    const modalItemList = document.getElementById('modal-item-list');
    const modalSearchInput = document.getElementById('modal-search-items');
    const editModalBody = document.getElementById('edit-modal-body');
    const editModalTitle = document.getElementById('edit-modal-title');
    const formEditRecord = document.getElementById('form-edit-record');
    const viewTransferModal = document.getElementById('view-transfer-modal');


    async function attemptLogin(username, loginCode) {
        if (!username || !loginCode) return;
        loginForm.style.display = 'none';
        loginError.textContent = '';
        loginLoader.style.display = 'flex';
        Logger.info(`Attempting to login...`);
        if (!SCRIPT_URL || !SCRIPT_URL.includes('macros/s')) {
            const errorMsg = 'SCRIPT_URL is not set or invalid in script.js.';
            Logger.error(errorMsg);
            loginError.textContent = errorMsg;
            loginLoader.style.display = 'none';
            loginForm.style.display = 'block';
            return;
        }
        try {
            const response = await fetch(`${SCRIPT_URL}?username=${encodeURIComponent(username)}&loginCode=${encodeURIComponent(loginCode)}`);
            if (!response.ok) throw new Error(`Network error: ${response.status} ${response.statusText}`);
            const data = await response.json();
            if (data.status === 'error' || !data.user) {
                throw new Error(data.message || 'Invalid username or login code.');
            }
            if (data.user.isDisabled === true || String(data.user.isDisabled).toUpperCase() === 'TRUE') {
                throw new Error('This user account has been disabled. Please contact an administrator.');
            }
            state.username = username;
            state.loginCode = loginCode;
            state.currentUser = data.user;
            Object.keys(data).forEach(key => {
                if (key !== 'user') state[key] = data[key] || [];
            });
            Logger.info(`Login successful for user: ${state.currentUser.Name} (Role: ${state.currentUser.RoleName})`);
            loginContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            initializeAppUI();
        } catch (error) {
            const userMsg = error.message.includes('Network error') ? 'Failed to connect to server.' : error.message;
            Logger.error('Login failed:', error);
            loginError.textContent = userMsg;
            loginLoader.style.display = 'none';
            loginForm.style.display = 'block';
            loginCodeInput.value = '';
            loginUsernameInput.value = '';
        }
    }

    async function postData(action, data, buttonEl) {
        setButtonLoading(true, buttonEl);
        Logger.debug(`POSTing action: ${action}`, data);
        const {
            username,
            loginCode
        } = state;
        if (!username || !loginCode) {
            Logger.error("Authentication token missing. Cannot perform action.");
            showToast('Session error. Please logout and login again.', 'error');
            setButtonLoading(false, buttonEl);
            return null;
        }

        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({
                    username,
                    loginCode,
                    action,
                    data
                })
            });
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'An unknown error occurred on the server.');
            Logger.info(`POST successful for ${action}`, result);
            return result;
        } catch (error) {
            const userMsg = `Action Failed: ${error.message}`;
            Logger.error(userMsg, error);
            showToast(userMsg, 'error');
            return null;
        } finally {
            setButtonLoading(false, buttonEl);
        }
    }

// PART 2 OF 4: MODAL & UI LOGIC
    function showView(viewId, subViewId = null) {
        Logger.info(`Switching view to: ${viewId}` + (subViewId ? `/${subViewId}` : ''));
        
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.querySelectorAll('#main-nav a').forEach(link => link.classList.remove('active'));

        const viewToShow = document.getElementById(`view-${viewId}`);
        if(viewToShow) viewToShow.classList.add('active');
        
        const activeLink = document.querySelector(`[data-view="${viewId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            document.getElementById('view-title').textContent = activeLink.querySelector('span').textContent;
        }

        const parentView = document.getElementById(`view-${viewId}`);
        if (parentView) {
            parentView.querySelectorAll('.sub-nav-item').forEach(btn => btn.classList.remove('active'));
            parentView.querySelectorAll('.sub-view').forEach(view => view.classList.remove('active'));

            let targetSubViewId = subViewId;

            if (!targetSubViewId) {
                const firstVisibleTab = parentView.querySelector('.sub-nav-item:not([style*="display: none"])');
                if (firstVisibleTab) {
                    targetSubViewId = firstVisibleTab.dataset.subview;
                }
            }
            
            if (targetSubViewId) {
                const subViewBtn = parentView.querySelector(`[data-subview="${targetSubViewId}"]`);
                if(subViewBtn) subViewBtn.classList.add('active');
                
                const subViewToShow = parentView.querySelector(`#subview-${targetSubViewId}`);
                if (subViewToShow) subViewToShow.classList.add('active');
            }
        }
        
        refreshViewData(viewId);
    }
    
    function openItemSelectorModal(event) {
        const context = event.target.dataset.context;
        if (!context) {
            Logger.error("openItemSelectorModal called without a data-context on the button.");
            return;
        }

        modalContext = context;
        let currentList = [];

        switch (context) {
            case 'receive': currentList = state.currentReceiveList; break;
            case 'transfer': currentList = state.currentTransferList; break;
            case 'issue': currentList = state.currentIssueList; break;
            case 'po': currentList = state.currentPOList; break;
            case 'return': currentList = state.currentReturnList; break;
            case 'request': currentList = state.currentRequestList; break;
            case 'edit-po': currentList = state.currentEditingPOList; break;
            case 'adjustment': currentList = state.currentAdjustmentList; break;
            default:
                Logger.error(`Unknown modal context: ${context}`);
                return;
        }

        state.modalSelections = new Set((currentList || []).map(item => item.itemCode));
        renderItemsInModal();
        itemSelectorModal.classList.add('active');
    }

    function openInvoiceSelectorModal() {
        modalContext = 'invoices';
        renderInvoicesInModal();
        invoiceSelectorModal.classList.add('active');
    }

    async function openHistoryModal(itemCode) {
        const item = findByKey(state.items, 'code', itemCode);
        if (!item) return;

        document.getElementById('history-modal-title').textContent = `History for: ${item.name} (${item.code})`;
        const historyModalBody = document.getElementById('history-modal-body');
        const priceHistoryContainer = historyModalBody.querySelector('#subview-price-history');
        const movementHistoryContainer = historyModalBody.querySelector('#subview-movement-history');
        const subNav = historyModalBody.querySelector('.sub-nav');

        priceHistoryContainer.innerHTML = '<div class="spinner"></div>';
        movementHistoryContainer.querySelector('#movement-history-table-container').innerHTML = '<div class="spinner"></div>';
        historyModal.classList.add('active');
        
        const subNavClickHandler = (e) => {
            if (!e.target.classList.contains('sub-nav-item')) return;
            const subviewId = e.target.dataset.subview;
            subNav.querySelectorAll('.sub-nav-item').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            historyModalBody.querySelectorAll('.sub-view').forEach(view => view.classList.remove('active'));
            const subViewToShow = historyModalBody.querySelector(`#subview-${subviewId}`);
            if (subViewToShow) subViewToShow.classList.add('active');
        };

        subNav.removeEventListener('click', subNavClickHandler);
        subNav.addEventListener('click', subNavClickHandler);

        const firstTab = subNav.querySelector('.sub-nav-item');
        if (firstTab) firstTab.click();

        const result = await postData('getItemHistory', { itemCode }, null);
        
        populateOptions(document.getElementById('history-filter-branch'), state.branches, 'All Branches', 'branchCode', 'name');
        const txTypes = ['receive', 'issue', 'transfer_out', 'transfer_in', 'return_out', 'adjustment_in', 'adjustment_out'];
        populateOptions(document.getElementById('history-filter-type'), txTypes.map(t => ({'type': t, 'name': t.replace(/_/g, ' ').toUpperCase()})), 'All Types', 'type', 'name');

        if (result && result.data) {
            renderPriceHistory(result.data.priceHistory);
            
            const renderFilteredMovementHistory = () => renderMovementHistory(result.data.movementHistory, itemCode);
            renderFilteredMovementHistory(); 

            ['history-filter-start-date', 'history-filter-end-date', 'history-filter-type', 'history-filter-branch'].forEach(id => {
                const element = document.getElementById(id);
                element.removeEventListener('change', renderFilteredMovementHistory);
                element.addEventListener('change', renderFilteredMovementHistory);
            });
        } else {
            priceHistoryContainer.innerHTML = '<p>Could not load price history.</p>';
            movementHistoryContainer.querySelector('#movement-history-table-container').innerHTML = '<p>Could not load movement history.</p>';
        }
    }

    function closeModal() {
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('active'));
        modalSearchInput.value = '';
        modalContext = null;
    }
    
    function openViewTransferModal(batchId) {
        const transferGroup = state.transactions.filter(t => t.batchId === batchId && t.type === 'transfer_out');
        if (transferGroup.length === 0) {
            showToast('Could not find transfer details.', 'error');
            return;
        }
        const first = transferGroup[0];
        const fromBranch = findByKey(state.branches, 'branchCode', first.fromBranchCode)?.name || first.fromBranchCode;
        const toBranch = findByKey(state.branches, 'branchCode', first.toBranchCode)?.name || first.toBranchCode;

        const modalBody = document.getElementById('view-transfer-modal-body');
        const items = transferGroup.map(tx => {
            const item = findByKey(state.items, 'code', tx.itemCode) || { name: 'DELETED' };
            return { itemCode: tx.itemCode, itemName: item.name, quantity: tx.quantity };
        });

        let itemsHtml = items.map(item => `<tr><td>${item.itemCode}</td><td>${item.itemName}</td><td>${item.quantity}</td></tr>`).join('');

        modalBody.innerHTML = `
            <p><strong>From Branch:</strong> ${fromBranch}</p>
            <p><strong>To Branch:</strong> ${toBranch}</p>
            <p><strong>Reference:</strong> ${first.ref || 'N/A'}</p>
            <hr>
            <h4>Items in Shipment</h4>
            <table><thead><tr><th>Code</th><th>Name</th><th>Quantity</th></tr></thead><tbody>${itemsHtml}</tbody></table>`;
        
        const modal = document.getElementById('view-transfer-modal');
        modal.querySelector('.modal-footer').innerHTML = `
            <button class="secondary modal-cancel">Cancel</button>
            <button id="btn-print-transfer-receipt" class="secondary">Print Receipt</button>
            <button id="btn-reject-transfer" class="danger" data-batch-id="${batchId}">Reject</button>
            <button id="btn-confirm-receive-transfer" class="primary" data-batch-id="${batchId}">Confirm Receipt</button>
        `;

        document.getElementById('btn-print-transfer-receipt').onclick = () => {
            const dataToPrint = { ...first, items: items, date: new Date() };
            generateTransferDocument(dataToPrint);
        };

        viewTransferModal.classList.add('active');
    }

    function openEditModal(type, id) {
        let record, formHtml;
        formEditRecord.dataset.type = type;
        formEditRecord.dataset.id = id;
        switch (type) {
            case 'item':
                record = findByKey(state.items, 'code', id);
                if (!record) return;
                editModalTitle.textContent = 'Edit Item';
                formHtml = `<div class="form-grid"><div class="form-group"><label>Item Code</label><input type="text" value="${record.code}" readonly></div><div class="form-group"><label for="edit-item-barcode">Barcode</label><input type="text" id="edit-item-barcode" name="barcode" value="${record.barcode || ''}"></div><div class="form-group"><label for="edit-item-name">Item Name</label><input type="text" id="edit-item-name" name="name" value="${record.name}" required></div><div class="form-group"><label for="edit-item-unit">Unit</label><input type="text" id="edit-item-unit" name="unit" value="${record.unit}" required></div><div class="form-group"><label for="edit-item-category">Category</label><select id="edit-item-category" name="category" required><option value="Packing">Packing</option><option value="Cleaning">Cleaning</option></select></div><div class="form-group"><label for="edit-item-supplier">Default Supplier</label><select id="edit-item-supplier" name="supplierCode"></select></div><div class="form-group span-full"><label for="edit-item-cost">Default Cost</label><input type="number" id="edit-item-cost" name="cost" step="0.01" min="0" value="${record.cost}" required></div></div>`;
                editModalBody.innerHTML = formHtml;
                document.getElementById('edit-item-category').value = record.category;
                const supplierSelect = document.getElementById('edit-item-supplier');
                populateOptions(supplierSelect, state.suppliers, 'Select Supplier', 'supplierCode', 'name');
                supplierSelect.value = record.supplierCode;
                break;
            case 'supplier':
                record = findByKey(state.suppliers, 'supplierCode', id);
                if (!record) return;
                editModalTitle.textContent = 'Edit Supplier';
                formHtml = `<div class="form-grid"><div class="form-group"><label>Supplier Code</label><input type="text" value="${record.supplierCode}" readonly></div><div class="form-group"><label for="edit-supplier-name">Supplier Name</label><input type="text" id="edit-supplier-name" name="name" value="${record.name}" required></div><div class="form-group"><label for="edit-supplier-contact">Contact Info</label><input type="text" id="edit-supplier-contact" name="contact" value="${record.contact || ''}"></div></div>`;
                editModalBody.innerHTML = formHtml;
                break;
            case 'branch':
                record = findByKey(state.branches, 'branchCode', id);
                if (!record) return;
                editModalTitle.textContent = 'Edit Branch';
                formHtml = `<div class="form-grid"><div class="form-group"><label>Branch Code</label><input type="text" value="${record.branchCode}" readonly></div><div class="form-group"><label for="edit-branch-name">Branch Name</label><input type="text" id="edit-branch-name" name="name" value="${record.name}" required></div></div>`;
                editModalBody.innerHTML = formHtml;
                break;
            case 'section':
                record = findByKey(state.sections, 'sectionCode', id);
                if (!record) return;
                editModalTitle.textContent = 'Edit Section';
                formHtml = `<div class="form-grid"><div class="form-group"><label>Section Code</label><input type="text" value="${record.sectionCode}" readonly></div><div class="form-group"><label for="edit-section-name">Section Name</label><input type="text" id="edit-section-name" name="name" value="${record.name}" required></div></div>`;
                editModalBody.innerHTML = formHtml;
                break;
            case 'user':
                record = findByKey(state.allUsers, 'Username', id);
                if (!record && id !== null) return;
                editModalTitle.textContent = id ? 'Edit User' : 'Add New User';
                const isUserDisabled = record ? (record.isDisabled === true || String(record.isDisabled).toUpperCase() === 'TRUE') : false;
                const currentUsername = record ? record.Username : '';
                const currentName = record ? record.Name : '';
                const currentRole = record ? record.RoleName : '';
                const currentBranch = record ? record.AssignedBranchCode : '';
                const currentSection = record ? record.AssignedSectionCode : '';

                const roleOptions = state.allRoles.map(r => `<option value="${r.RoleName}" ${r.RoleName === currentRole ? 'selected' : ''}>${r.RoleName}</option>`).join('');
                const branchOptions = state.branches.map(b => `<option value="${b.branchCode}" ${b.branchCode === currentBranch ? 'selected' : ''}>${b.name}</option>`).join('');
                const sectionOptions = state.sections.map(s => `<option value="${s.sectionCode}" ${s.sectionCode === currentSection ? 'selected' : ''}>${s.name}</option>`).join('');
                
                formHtml = `<div class="form-grid"><div class="form-group"><label>Username</label><input type="text" id="edit-user-username" name="Username" value="${currentUsername}" ${id ? 'readonly' : 'required'}></div><div class="form-group"><label for="edit-user-name">Full Name</label><input type="text" id="edit-user-name" name="Name" value="${currentName}" required></div><div class="form-group"><label for="edit-user-role">Role</label><select id="edit-user-role" name="RoleName" required>${roleOptions}</select></div><div class="form-group"><label for="edit-user-branch">Assigned Branch</label><select id="edit-user-branch" name="AssignedBranchCode"><option value="">None</option>${branchOptions}</select></div><div class="form-group"><label for="edit-user-section">Assigned Section</label><select id="edit-user-section" name="AssignedSectionCode"><option value="">None</option>${sectionOptions}</select></div><div class="form-group span-full"><label for="edit-user-password">Password / Login Code ${id ? '(leave blank to keep unchanged)' : ''}</label><input type="password" id="edit-user-password" name="LoginCode" ${!id ? 'required' : ''}></div>`;
                if(id) {
                    const btnText = isUserDisabled ? 'Enable User' : 'Disable User';
                    const btnClass = isUserDisabled ? 'primary' : 'danger';
                    formHtml += `<div class="form-group span-full"><button type="button" id="btn-toggle-user-status" class="${btnClass}">${btnText}</button></div>`;
                }
                formHtml += `</div>`;
                editModalBody.innerHTML = formHtml;

                const toggleBtn = document.getElementById('btn-toggle-user-status');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', async () => {
                        const newStatus = !isUserDisabled;
                        const confirmationText = newStatus ? `Are you sure you want to disable this user? They will not be able to log in.` : `Are you sure you want to enable this user? They will be able to log in again.`;
                        if (confirm(confirmationText)) {
                            const result = await postData('updateUser', { Username: id, updates: { isDisabled: newStatus } }, toggleBtn);
                            if (result) {
                                showToast(`User ${newStatus ? 'disabled' : 'enabled'} successfully!`, 'success');
                                closeModal();
                                reloadDataAndRefreshUI();
                            }
                        }
                    });
                }
                break;
            case 'role':
                record = findByKey(state.allRoles, 'RoleName', id);
                if (!record) {
                    showToast('Role data not found. Please refresh and try again.', 'error');
                    return;
                }
                editModalTitle.textContent = `Edit Permissions for ${record.RoleName}`;

                const permissionCategories = {
                    'General Access': ['viewDashboard', 'viewActivityLog'],
                    'User Management': ['manageUsers', 'opBackupRestore'],
                    'Data Management': ['viewSetup', 'viewMasterData', 'createItem', 'editItem', 'createSupplier', 'editSupplier', 'createBranch', 'editBranch', 'createSection', 'editSection'],
                    'Stock Operations': ['viewOperations', 'opReceive', 'opReceiveWithoutPO', 'opIssue', 'opTransfer', 'opReturn', 'opStockAdjustment'],
                    'Purchasing': ['viewPurchasing', 'opCreatePO'],
                    'Item Requests': ['viewRequests', 'opRequestItems', 'opApproveIssueRequest', 'opApproveResupplyRequest'],
                    'Financials': ['viewPayments', 'opRecordPayment', 'opFinancialAdjustment', 'opApproveFinancials', 'opEditInvoice'],
                    'Reporting': ['viewReports', 'viewStockLevels', 'viewTransactionHistory', 'viewAllBranches'],
                };
                
                formHtml = '<h3>Permissions</h3>';
                for (const category in permissionCategories) {
                    formHtml += `<h4 class="permission-category">${category}</h4><div class="form-grid permissions-grid">`;
                    permissionCategories[category].forEach(key => {
                        const isChecked = record[key] === true || String(record[key]).toUpperCase() === 'TRUE';
                        formHtml += `<div class="form-group-checkbox"><input type="checkbox" id="edit-perm-${key}" name="${key}" ${isChecked ? 'checked' : ''}><label for="edit-perm-${key}">${key}</label></div>`;
                    });
                    formHtml += `</div>`;
                }

                formHtml += `<div class="form-group span-full" style="margin-top: 24px;"><button type="button" id="btn-delete-role" class="danger">Delete Role</button></div>`;
                editModalBody.innerHTML = formHtml;
                break;
        }
        editModal.classList.add('active');
    }

    async function handleUpdateSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const type = formEditRecord.dataset.type;
        const id = formEditRecord.dataset.id;
        const formData = new FormData(formEditRecord);
        let payload = {}, action;

        if (type === 'user') {
            action = id ? 'updateUser' : 'addUser';
            payload = {};
            for (let [key, value] of formData.entries()) {
                 if (key === 'LoginCode' && value === '') continue;
                 payload[key] = value;
            }
            if(id) {
                payload = { Username: id, updates: {} };
                for (let [key, value] of formData.entries()) {
                    if (key === 'LoginCode' && value === '') continue;
                    if (key !== 'Username') payload.updates[key] = value;
                }
            }
        } else if (type === 'role') {
            action = 'updateRolePermissions';
            const updates = {};
            const allPerms = Object.keys(findByKey(state.allRoles, 'RoleName', id) || {});
            allPerms.forEach(key => {
                if (key !== 'RoleName') {
                    updates[key] = formData.has(key);
                }
            });
            payload = { RoleName: id, updates: updates };
        } else {
            action = 'updateData';
            const updates = {};
            for (let [key, value] of formData.entries()) {
                updates[key] = value;
            }
            payload = { type, id, updates };
        }
        
        const result = await postData(action, payload, btn);
        if (result) {
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} ${id ? 'updated' : 'added'} successfully!`, 'success');
            closeModal();
            await reloadDataAndRefreshUI();
        }
    }

    function renderItemsInModal(filter = '') {
        modalItemList.innerHTML = '';
        const lowercasedFilter = filter.toLowerCase();
        state.items.filter(item => item.name.toLowerCase().includes(lowercasedFilter) || item.code.toLowerCase().includes(lowercasedFilter)).forEach(item => {
            const isChecked = state.modalSelections.has(item.code);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'modal-item';
            itemDiv.innerHTML = `<input type="checkbox" id="modal-item-${item.code}" data-code="${item.code}" ${isChecked ? 'checked' : ''}><label for="modal-item-${item.code}"><strong>${item.name}</strong><br><small style="color:var(--text-light-color)">Code: ${item.code} | Category: ${item.category || 'N/A'}</small></label>`;
            modalItemList.appendChild(itemDiv);
        });
    }

    function renderInvoicesInModal() {
        const modalInvoiceList = document.getElementById('modal-invoice-list');
        const supplierCode = document.getElementById('payment-supplier-select').value;
        const supplierFinancials = calculateSupplierFinancials();
        const supplierInvoices = supplierFinancials[supplierCode]?.invoices;
        modalInvoiceList.innerHTML = '';
        if (!supplierInvoices || Object.keys(supplierInvoices).length === 0) {
            modalInvoiceList.innerHTML = '<p>No invoices found for this supplier.</p>';
            return;
        }
        const unpaidInvoices = Object.values(supplierInvoices).filter(inv => inv.status !== 'Paid');
        if (unpaidInvoices.length === 0) {
            modalInvoiceList.innerHTML = '<p>No unpaid invoices for this supplier.</p>';
            return;
        }
        unpaidInvoices.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(invoice => {
            const isChecked = state.invoiceModalSelections.has(invoice.number);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'modal-item';
            itemDiv.innerHTML = `<input type="checkbox" id="modal-invoice-${invoice.number}" data-number="${invoice.number}" ${isChecked ? 'checked' : ''}><label for="modal-invoice-${invoice.number}"><strong>Invoice #: ${invoice.number}</strong><br><small style="color:var(--text-light-color)">Date: ${new Date(invoice.date).toLocaleDateString()} | Amount Due: ${invoice.balance.toFixed(2)} EGP</small></label>`;
            modalInvoiceList.appendChild(itemDiv);
        });
    }

    function handleModalCheckboxChange(e) {
        if (e.target.type === 'checkbox') {
            const itemCode = e.target.dataset.code;
            if (e.target.checked) {
                state.modalSelections.add(itemCode);
            } else {
                state.modalSelections.delete(itemCode);
            }
        }
    }

    function handleInvoiceModalCheckboxChange(e) {
        if (e.target.type === 'checkbox') {
            const invoiceNumber = e.target.dataset.number;
            if (e.target.checked) {
                state.invoiceModalSelections.add(invoiceNumber);
            } else {
                state.invoiceModalSelections.delete(invoiceNumber);
            }
        }
    }

    function renderPaymentList() {
        const supplierCode = document.getElementById('payment-supplier-select').value;
        const container = document.getElementById('payment-invoice-list-container');
        if (!supplierCode) {
            container.style.display = 'none';
            return;
        }
        const supplierInvoices = calculateSupplierFinancials()[supplierCode]?.invoices;
        const tableBody = document.getElementById('table-payment-list').querySelector('tbody');
        tableBody.innerHTML = '';
        let total = 0;
        if (state.invoiceModalSelections.size === 0) {
            container.style.display = 'none';
            return;
        }
        state.invoiceModalSelections.forEach(invNum => {
            const invoice = supplierInvoices[invNum];
            if (!invoice) return;
            const balance = invoice.balance;
            total += balance;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${invoice.number}</td><td>${balance.toFixed(2)} EGP</td><td><input type="number" class="table-input payment-amount-input" data-invoice="${invoice.number}" value="${balance.toFixed(2)}" step="0.01" min="0" max="${balance.toFixed(2)}" style="max-width: 150px;"></td>`;
            tableBody.appendChild(tr);
        });
        document.getElementById('payment-total-amount').textContent = `${total.toFixed(2)} EGP`;
        container.style.display = 'block';
    }

    function handlePaymentInputChange() {
        let total = 0;
        document.querySelectorAll('.payment-amount-input').forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        document.getElementById('payment-total-amount').textContent = `${total.toFixed(2)} EGP`;
    }

    function confirmModalSelection() {
        const selectedCodes = state.modalSelections;
        const addToList = (currentList, newList, item) => {
            const existing = (currentList || []).find(i => i.itemCode === item.code);
            if (existing) {
                newList.push(existing);
            } else {
                const newItem = { itemCode: item.code, itemName: item.name, quantity: 1, cost: item.cost };
                if (modalContext === 'adjustment') {
                    newItem.physicalCount = 0;
                }
                newList.push(newItem);
            }
        };

        const createNewList = (currentList) => {
            const newList = [];
            selectedCodes.forEach(code => {
                const item = findByKey(state.items, 'code', code);
                if (item) addToList(currentList, newList, item);
            });
            return newList;
        };

        switch (modalContext) {
            case 'invoices': renderPaymentList(); break;
            case 'receive': state.currentReceiveList = createNewList(state.currentReceiveList); renderReceiveListTable(); break;
            case 'transfer': state.currentTransferList = createNewList(state.currentTransferList); renderTransferListTable(); break;
            case 'issue': state.currentIssueList = createNewList(state.currentIssueList); renderIssueListTable(); break;
            case 'po': state.currentPOList = createNewList(state.currentPOList); renderPOListTable(); break;
            case 'return': state.currentReturnList = createNewList(state.currentReturnList); renderReturnListTable(); break;
            case 'request': state.currentRequestList = createNewList(state.currentRequestList); renderRequestListTable(); break;
            case 'edit-po': state.currentEditingPOList = createNewList(state.currentEditingPOList); renderPOEditListTable(); break;
            case 'adjustment': state.currentAdjustmentList = createNewList(state.currentAdjustmentList); renderAdjustmentListTable(); break;
        }
        closeModal();
    }
    
    function showToast(message, type = 'success') {
        if (type === 'error') Logger.error(`User Toast: ${message}`);
        const container = document.getElementById('toast-container');
        if (!container) {
            console.error("Toast container not found! Message:", message);
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    function setButtonLoading(isLoading, buttonEl) {
        if (!buttonEl) return;
        if (isLoading) {
            buttonEl.disabled = true;
            buttonEl.dataset.originalText = buttonEl.innerHTML;
            buttonEl.innerHTML = '<div class="button-spinner"></div><span>Processing...</span>';
        } else {
            buttonEl.disabled = false;
            if (buttonEl.dataset.originalText) {
                buttonEl.innerHTML = buttonEl.dataset.originalText;
            }
        }
    }

// PART 3 OF 4: VIEW RENDERING & DOCUMENT GENERATION
    function renderItemsTable(data = state.items) {
        const tbody = document.getElementById('table-items').querySelector('tbody');
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No items found.</td></tr>';
            return;
        }
        const canEdit = userCan('editItem');
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${item.code}</td><td>${item.name}</td><td>${item.category || 'N/A'}</td><td>${item.unit}</td><td>${(parseFloat(item.cost) || 0).toFixed(2)} EGP</td><td><div class="action-buttons"><button class="secondary small btn-edit" data-type="item" data-id="${item.code}" ${!canEdit ? 'disabled' : ''}>Edit</button><button class="secondary small btn-history" data-type="item" data-id="${item.code}">History</button></div></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderSuppliersTable(data = state.suppliers) {
        const tbody = document.getElementById('table-suppliers').querySelector('tbody');
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No suppliers found.</td></tr>';
            return;
        }
        const financials = calculateSupplierFinancials();
        const canEdit = userCan('editSupplier');
        data.forEach(supplier => {
            const balance = financials[supplier.supplierCode]?.balance || 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${supplier.supplierCode || ''}</td><td>${supplier.name}</td><td>${supplier.contact}</td><td>${balance.toFixed(2)} EGP</td><td>${canEdit ? `<button class="secondary small btn-edit" data-type="supplier" data-id="${supplier.supplierCode}">Edit</button>`: 'N/A'}</td>`;
            tbody.appendChild(tr);
        });
    }

    function renderBranchesTable(data = state.branches) {
        const tbody = document.getElementById('table-branches').querySelector('tbody');
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No branches found.</td></tr>';
            return;
        }
        const canEdit = userCan('editBranch');
        data.forEach(branch => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${branch.branchCode || ''}</td><td>${branch.name}</td><td>${canEdit ? `<button class="secondary small btn-edit" data-type="branch" data-id="${branch.branchCode}">Edit</button>`: 'N/A'}</td>`;
            tbody.appendChild(tr);
        });
    }

    function renderSectionsTable(data = state.sections) {
        const tbody = document.getElementById('table-sections').querySelector('tbody');
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No sections found.</td></tr>';
            return;
        }
        const canEdit = userCan('editSection');
        data.forEach(section => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${section.sectionCode || ''}</td><td>${section.name}</td><td>${canEdit ? `<button class="secondary small btn-edit" data-type="section" data-id="${section.sectionCode}">Edit</button>`: 'N/A'}</td>`;
            tbody.appendChild(tr);
        });
    }

    const renderDynamicListTable = (tbodyId, list, columnsConfig, emptyMessage, totalizerFn) => {
        const tbody = document.getElementById(tbodyId).querySelector('tbody');
        tbody.innerHTML = '';
        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columnsConfig.length + 1}" style="text-align:center;">${emptyMessage}</td></tr>`;
            if (totalizerFn) totalizerFn();
            return;
        }
        const stock = calculateStockLevels();
        list.forEach((item, index) => {
            const tr = document.createElement('tr');
            let cellsHtml = '';
            columnsConfig.forEach(col => {
                let content = '';
                const fromBranch = document.getElementById(col.branchSelectId)?.value;
                const availableStock = (stock[fromBranch]?.[item.itemCode]?.quantity || 0);
                switch (col.type) {
                    case 'text': content = item[col.key]; break;
                    case 'number_input': content = `<input type="number" class="table-input" value="${item[col.key] || 1}" min="${col.min || 0.01}" ${col.maxKey ? `max="${availableStock}"` : ''} step="${col.step || 0.01}" data-index="${index}" data-field="${col.key}">`; break;
                    case 'cost_input': content = `<input type="number" class="table-input" value="${(item.cost || 0).toFixed(2)}" min="0" step="0.01" data-index="${index}" data-field="cost">`; break;
                    case 'calculated': content = `<span>${col.calculator(item)}</span>`; break;
                    case 'available_stock': content = availableStock.toFixed(2); break;
                }
                cellsHtml += `<td>${content}</td>`;
            });
            cellsHtml += `<td><button class="danger small" data-index="${index}">X</button></td>`;
            tr.innerHTML = cellsHtml;
            tbody.appendChild(tr);
        });
        if (totalizerFn) totalizerFn();
    };
    
    function renderReceiveListTable() { renderDynamicListTable('table-receive-list', state.currentReceiveList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'number_input', key: 'quantity' }, { type: 'cost_input', key: 'cost' }, { type: 'calculated', calculator: item => `${((parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0)).toFixed(2)} EGP` } ], 'No items selected. Click "Select Items".', updateReceiveGrandTotal); }
    function renderTransferListTable() { renderDynamicListTable('table-transfer-list', state.currentTransferList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'available_stock', branchSelectId: 'transfer-from-branch' }, { type: 'number_input', key: 'quantity', maxKey: true, branchSelectId: 'transfer-from-branch' } ], 'No items selected. Click "Select Items".', updateTransferGrandTotal); }
    function renderIssueListTable() { renderDynamicListTable('table-issue-list', state.currentIssueList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'available_stock', branchSelectId: 'issue-from-branch' }, { type: 'number_input', key: 'quantity', maxKey: true, branchSelectId: 'issue-from-branch' } ], 'No items selected. Click "Select Items".', updateIssueGrandTotal); }
    function renderPOListTable() { renderDynamicListTable('table-po-list', state.currentPOList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'number_input', key: 'quantity' }, { type: 'cost_input', key: 'cost' }, { type: 'calculated', calculator: item => `${((parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0)).toFixed(2)} EGP` } ], 'No items selected. Click "Select Items".', updatePOGrandTotal); }
    function renderPOEditListTable() { renderDynamicListTable('table-edit-po-list', state.currentEditingPOList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'number_input', key: 'quantity' }, { type: 'cost_input', key: 'cost' }, { type: 'calculated', calculator: item => `${((parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0)).toFixed(2)} EGP` } ], 'No items selected. Click "Select Items".', updatePOEditGrandTotal); }
    function renderReturnListTable() { renderDynamicListTable('table-return-list', state.currentReturnList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'available_stock', branchSelectId: 'return-branch' }, { type: 'number_input', key: 'quantity', maxKey: true, branchSelectId: 'return-branch' }, { type: 'cost_input', key: 'cost' } ], 'No items selected. Click "Select Items".', updateReturnGrandTotal); }
    function renderRequestListTable() { renderDynamicListTable('table-request-list', state.currentRequestList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'number_input', key: 'quantity' } ], 'No items selected. Click "Select Items".', null); }

    function renderAdjustmentListTable() {
        const tbody = document.getElementById('table-adjustment-list').querySelector('tbody');
        tbody.innerHTML = '';
        if (!state.currentAdjustmentList || state.currentAdjustmentList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No items selected for adjustment.</td></tr>`;
            return;
        }
        const stock = calculateStockLevels();
        const branchCode = document.getElementById('adjustment-branch').value;

        state.currentAdjustmentList.forEach((item, index) => {
            const systemQty = (branchCode && stock[branchCode]?.[item.itemCode]?.quantity) || 0;
            const physicalCount = typeof item.physicalCount !== 'undefined' ? item.physicalCount : systemQty;
            const adjustment = physicalCount - systemQty;
            
            item.physicalCount = physicalCount;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.itemCode}</td>
                <td>${item.itemName}</td>
                <td>${systemQty.toFixed(2)}</td>
                <td><input type="number" class="table-input" value="${physicalCount}" min="0" step="0.01" data-index="${index}" data-field="physicalCount"></td>
                <td style="font-weight: bold; color: ${adjustment > 0 ? 'var(--secondary-color)' : (adjustment < 0 ? 'var(--danger-color)' : 'inherit')}">${adjustment.toFixed(2)}</td>
                <td><button class="danger small" data-index="${index}">X</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderItemCentricStockView(itemsToRender = state.items) {
        const container = document.getElementById('item-centric-stock-container');
        if (!container) return;
        const stockByBranch = calculateStockLevels();
        const branchesToDisplay = getVisibleBranchesForCurrentUser();
        let tableHTML = `<table id="table-stock-levels-by-item"><thead><tr><th>Code</th><th>Item Name</th>`;
        branchesToDisplay.forEach(b => { tableHTML += `<th>${b.name}</th>` });
        tableHTML += `<th>Total</th></tr></thead><tbody>`;
        itemsToRender.forEach(item => {
            tableHTML += `<tr><td>${item.code}</td><td>${item.name}</td>`;
            let total = 0;
            branchesToDisplay.forEach(branch => {
                const qty = stockByBranch[branch.branchCode]?.[item.code]?.quantity || 0;
                total += qty;
                tableHTML += `<td>${qty > 0 ? qty.toFixed(2) : '-'}</td>`;
            });
            tableHTML += `<td><strong>${total.toFixed(2)}</strong></td></tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }

    function renderItemInquiry(searchTerm) {
        const resultsContainer = document.getElementById('item-inquiry-results');
        if (!searchTerm) {
            resultsContainer.innerHTML = '';
            return;
        }
        const stockByBranch = calculateStockLevels();
        const filteredItems = state.items.filter(i => i.name.toLowerCase().includes(searchTerm) || i.code.toLowerCase().includes(searchTerm));
        let html = '';
        const branchesToDisplay = getVisibleBranchesForCurrentUser();
        filteredItems.slice(0, 10).forEach(item => {
            html += `<h4>${item.name} (${item.code})</h4><table><thead><tr><th>Branch</th><th>Qty</th><th>Value</th></tr></thead><tbody>`;
            let found = false;
            let totalQty = 0;
            let totalValue = 0;
            branchesToDisplay.forEach(branch => {
                const itemStock = stockByBranch[branch.branchCode]?.[item.code];
                if (itemStock && itemStock.quantity > 0) {
                    const value = itemStock.quantity * itemStock.avgCost;
                    html += `<tr><td>${branch.name} (${branch.branchCode || ''})</td><td>${itemStock.quantity.toFixed(2)}</td><td>${value.toFixed(2)} EGP</td></tr>`;
                    totalQty += itemStock.quantity;
                    totalValue += value;
                    found = true;
                }
            });
            if (!found) {
                html += `<tr><td colspan="3">No stock for this item.</td></tr>`;
            } else {
                html += `<tr style="font-weight:bold; background-color: var(--bg-color);"><td>Total</td><td>${totalQty.toFixed(2)}</td><td>${totalValue.toFixed(2)} EGP</td></tr>`
            }
            html += `</tbody></table><hr>`;
        });
        resultsContainer.innerHTML = html;
    }
    
    function renderSupplierStatement(supplierCode, startDateStr, endDateStr) {
        const resultsContainer = document.getElementById('supplier-statement-results');
        const exportBtn = document.getElementById('btn-export-supplier-statement');
        const supplier = findByKey(state.suppliers, 'supplierCode', supplierCode);
        if (!supplier) {
            exportBtn.disabled = true;
            return;
        }
        const financials = calculateSupplierFinancials();
        const supplierData = financials[supplierCode];
        if(!supplierData) {
            resultsContainer.innerHTML = '<p>No financial data found for this supplier.</p>';
            exportBtn.disabled = true;
            return;
        }
        const sDate = startDateStr ? new Date(startDateStr) : null;
        if(sDate) sDate.setHours(0,0,0,0);
        const eDate = endDateStr ? new Date(endDateStr) : null;
        if (eDate) eDate.setHours(23, 59, 59, 999);
        let openingBalance = 0;
        if (sDate) {
            supplierData.events.forEach(event => {
                if (new Date(event.date) < sDate) {
                    openingBalance += (event.debit || 0) - (event.credit || 0);
                }
            });
        }
        const filteredEvents = supplierData.events.filter(event => {
            const eventDate = new Date(event.date);
            return (!sDate || eventDate >= sDate) && (!eDate || eventDate <= eDate);
        });
        let balance = openingBalance;
        let tableBodyHtml = '';
        if (sDate) {
            tableBodyHtml += `<tr style="background-color: var(--bg-color);"><td colspan="3"><strong>Opening Balance as of ${sDate.toLocaleDateString()}</strong></td><td>-</td><td>-</td><td><strong>${openingBalance.toFixed(2)} EGP</strong></td></tr>`;
        }
        filteredEvents.forEach(event => {
            balance += (event.debit || 0) - (event.credit || 0);
            tableBodyHtml += `<tr><td>${new Date(event.date).toLocaleDateString()}</td><td>${event.type}</td><td>${event.ref}</td><td>${event.debit > 0 ? event.debit.toFixed(2) : '-'}</td><td>${event.credit > 0 ? event.credit.toFixed(2) : '-'}</td><td>${balance.toFixed(2)} EGP</td></tr>`;
        });
        let dateHeader = `for all time`;
        if (sDate && eDate) {
            dateHeader = `from ${sDate.toLocaleDateString()} to ${eDate.toLocaleDateString()}`;
        } else if (sDate) {
            dateHeader = `from ${sDate.toLocaleDateString()}`;
        } else if (eDate) {
            dateHeader = `until ${eDate.toLocaleDateString()}`;
        }
        resultsContainer.innerHTML = `<div class="printable-document"><div class="printable-header"><div><h2>Supplier Statement: ${supplier.name}</h2><p style="margin:0; color: var(--text-light-color);">For period: ${dateHeader}</p></div><button class="secondary small no-print" onclick="printReport('supplier-statement-results')">Print</button></div><p><strong>Date Generated:</strong> ${new Date().toLocaleString()}</p><div class="report-area"><table id="table-supplier-statement-report"><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>${tableBodyHtml}</tbody><tfoot><tr style="font-weight:bold; background-color: var(--bg-color);"><td colspan="5" style="text-align:right;">Closing Balance:</td><td>${balance.toFixed(2)} EGP</td></tr></tfoot></table></div></div>`;
        resultsContainer.style.display = 'block';
        exportBtn.disabled = false;
    }

    function renderConsumptionReport(config) {
        const { resultsContainerId, exportBtnId, data, title, entityName, dateHeader, historicalCosts, qtyColumnHeader = 'Total Qty Consumed' } = config;
        const resultsContainer = document.getElementById(resultsContainerId);
        const exportBtn = document.getElementById(exportBtnId);
    
        const hasValue = !!historicalCosts;
    
        const groupedByItem = {};
        (data || []).forEach(t => {
            if (!groupedByItem[t.itemCode]) {
                const item = findByKey(state.items, 'code', t.itemCode) || { name: 'N/A', unit: 'N/A', category: 'N/A' };
                groupedByItem[t.itemCode] = { item, totalQty: 0, totalValue: 0 };
            }
            
            const quantity = parseFloat(t.quantity) || 0;
            groupedByItem[t.itemCode].totalQty += quantity;
    
            if (hasValue) {
                const costAtTransaction = historicalCosts[`${t.batchId}-${t.itemCode}`] || findByKey(state.items, 'code', t.itemCode)?.cost || 0;
                groupedByItem[t.itemCode].totalValue += quantity * costAtTransaction;
            }
        });
    
        let tableBodyHtml = '';
        const sortedGroups = Object.values(groupedByItem).sort((a, b) => a.item.name.localeCompare(b.item.name));
    
        sortedGroups.forEach(group => {
            tableBodyHtml += `<tr>
                <td>${group.item.code}</td>
                <td>${group.item.name}</td>
                <td>${group.item.category || 'N/A'}</td>
                <td style="text-align:right;">${group.totalQty.toFixed(2)} ${group.item.unit}</td>
                ${hasValue ? `<td style="text-align:right;">${group.totalValue.toFixed(2)} EGP</td>` : ''}
            </tr>`;
        });
        
        const grandTotalValue = sortedGroups.reduce((sum, group) => sum + group.totalValue, 0);
    
        const headerHtml = `<thead><tr><th>Item Code</th><th>Item Name</th><th>Category</th><th style="text-align:right;">${qtyColumnHeader}</th>${hasValue ? '<th style="text-align:right;">Total Value</th>' : ''}</tr></thead>`;
        const footerHtml = hasValue ? `<tfoot><tr style="font-weight:bold; background-color: var(--bg-color);">
            <td colspan="4" style="text-align:right;">Grand Total Value:</td>
            <td style="text-align:right;">${grandTotalValue.toFixed(2)} EGP</td>
        </tr></tfoot>` : '';
    
        resultsContainer.innerHTML = `<div class="printable-document">
            <div class="printable-header"><div><h2>${title}: ${entityName}</h2><p style="margin:0; color: var(--text-light-color);">For period: ${dateHeader}</p></div><button class="secondary small no-print" onclick="printReport('${resultsContainerId}')">Print</button></div>
            <div class="report-area"><table id="table-${resultsContainerId}-report">
                ${headerHtml}
                <tbody>${tableBodyHtml}</tbody>
                ${footerHtml}
            </table></div></div>`;
        resultsContainer.style.display = 'block';
        exportBtn.disabled = false;
    }
    
    function renderPriceHistory(priceHistory) {
        const container = document.getElementById('subview-price-history');
        let html = '<h4>Price Change Log</h4><table id="table-price-history"><thead><tr><th>Date</th><th>Old Cost</th><th>New Cost</th><th>Change</th><th>Source</th><th>Updated By</th></tr></thead><tbody>';
        if (!priceHistory || priceHistory.length === 0) {
            html += '<tr><td colspan="6" style="text-align:center;">No price history found for this item.</td></tr>';
        } else {
            priceHistory.forEach(h => {
                const oldCost = parseFloat(h.OldCost) || 0;
                const newCost = parseFloat(h.NewCost) || 0;
                const change = newCost - oldCost;
                const changeClass = change > 0 ? 'danger' : (change < 0 ? 'success' : 'info');
                const changeIcon = change > 0 ? '▲' : (change < 0 ? '▼' : '–');
                html += `<tr><td>${new Date(h.Timestamp).toLocaleString()}</td><td>${oldCost.toFixed(2)}</td><td>${newCost.toFixed(2)}</td><td style="color:var(--${changeClass}-color);">${changeIcon} ${Math.abs(change).toFixed(2)}</td><td>${h.Source}</td><td>${h.UpdatedBy}</td></tr>`;
            });
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function renderMovementHistory(movementHistory, itemCode) {
        const container = document.getElementById('movement-history-table-container');
        
        const startDate = document.getElementById('history-filter-start-date').value;
        const endDate = document.getElementById('history-filter-end-date').value;
        const type = document.getElementById('history-filter-type').value;
        const branch = document.getElementById('history-filter-branch').value;
        
        const sDate = startDate ? new Date(startDate) : null;
        if(sDate) sDate.setHours(0,0,0,0);
        const eDate = endDate ? new Date(endDate) : null;
        if(eDate) eDate.setHours(23,59,59,999);

        const filteredHistory = (movementHistory || []).filter(t => {
            const eventDate = new Date(t.date);
            const typeMatch = !type || t.type === type;
            const branchMatch = !branch || t.fromBranchCode === branch || t.toBranchCode === branch || t.branchCode === branch;
            const startDateMatch = !sDate || eventDate >= sDate;
            const endDateMatch = !eDate || eventDate <= eDate;
            return typeMatch && branchMatch && startDateMatch && endDateMatch;
        });
        
        let html = '<table id="table-movement-history"><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Details</th><th style="text-align:right;">Qty In</th><th style="text-align:right;">Qty Out</th></tr></thead><tbody>';
        if (filteredHistory.length === 0) {
            html += '<tr><td colspan="6" style="text-align:center;">No movements found for the selected filters.</td></tr>';
        } else {
            filteredHistory.forEach(t => {
                let type = t.type.replace('_', ' ').toUpperCase();
                let details = '', qtyIn = '-', qtyOut = '-';
                const quantity = parseFloat(t.quantity) || 0;

                switch (t.type) {
                    case 'receive': 
                        details = `From: ${findByKey(state.suppliers, 'supplierCode', t.supplierCode)?.name || t.supplierCode} To: ${findByKey(state.branches, 'branchCode', t.branchCode)?.name || t.branchCode}`;
                        qtyIn = quantity.toFixed(2);
                        break;
                    case 'issue':
                        details = `From: ${findByKey(state.branches, 'branchCode', t.fromBranchCode)?.name || t.fromBranchCode} To: ${findByKey(state.sections, 'sectionCode', t.sectionCode)?.name || t.sectionCode}`;
                        qtyOut = quantity.toFixed(2);
                        break;
                    case 'transfer_out':
                        details = `Sent from: ${findByKey(state.branches, 'branchCode', t.fromBranchCode)?.name} To: ${findByKey(state.branches, 'branchCode', t.toBranchCode)?.name}`;
                        qtyOut = quantity.toFixed(2);
                        break;
                    case 'transfer_in':
                        details = `Received at: ${findByKey(state.branches, 'branchCode', t.toBranchCode)?.name} From: ${findByKey(state.branches, 'branchCode', t.fromBranchCode)?.name}`;
                        qtyIn = quantity.toFixed(2);
                        break;
                    case 'return_out':
                        details = `Returned from: ${findByKey(state.branches, 'branchCode', t.fromBranchCode)?.name} To: ${findByKey(state.suppliers, 'supplierCode', t.supplierCode)?.name}`;
                        qtyOut = quantity.toFixed(2);
                        break;
                    case 'adjustment_in':
                        details = `Stock count at: ${findByKey(state.branches, 'branchCode', t.fromBranchCode)?.name}`;
                        qtyIn = quantity.toFixed(2);
                        break;
                    case 'adjustment_out':
                        details = `Stock count at: ${findByKey(state.branches, 'branchCode', t.fromBranchCode)?.name}`;
                        qtyOut = quantity.toFixed(2);
                        break;
                }
                html += `<tr><td>${new Date(t.date).toLocaleString()}</td><td>${type}</td><td>${t.invoiceNumber || t.ref || t.batchId}</td><td>${details}</td><td style="text-align:right;">${qtyIn}</td><td style="text-align:right;">${qtyOut}</td></tr>`;
            });
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function renderTransactionHistory(filters = {}) {
        const tbody = document.getElementById('table-transaction-history').querySelector('tbody');
        tbody.innerHTML = '';
        
        let allTx = [...state.transactions];
        let allPo = [...state.purchaseOrders];

        if (!userCan('viewAllBranches')) {
            const branchCode = state.currentUser.AssignedBranchCode;
            if (branchCode) {
                allTx = allTx.filter(t => String(t.branchCode) === branchCode || String(t.fromBranchCode) === branchCode || String(t.toBranchCode) === branchCode);
                allPo = []; 
            }
        }
        
        let allHistoryItems = [ ...allTx, ...allPo.map(po => ({...po, type: 'po', batchId: po.poId, ref: po.poId})) ];

        const sDate = filters.startDate ? new Date(filters.startDate) : null;
        if(sDate) sDate.setHours(0,0,0,0);
        const eDate = filters.endDate ? new Date(filters.endDate) : null;
        if(eDate) eDate.setHours(23,59,59,999);

        if (sDate) allHistoryItems = allHistoryItems.filter(t => new Date(t.date) >= sDate);
        if (eDate) allHistoryItems = allHistoryItems.filter(t => new Date(t.date) <= eDate);
        if (filters.type) allHistoryItems = allHistoryItems.filter(t => String(t.type) === String(filters.type));
        if (filters.branch) allHistoryItems = allHistoryItems.filter(t => String(t.branchCode) === String(filters.branch) || String(t.fromBranchCode) === String(filters.branch) || String(t.toBranchCode) === String(filters.branch));
        if (filters.searchTerm) {
            const lowerFilter = filters.searchTerm.toLowerCase();
            allHistoryItems = allHistoryItems.filter(t => {
                const item = findByKey(state.items, 'code', t.itemCode);
                return (t.ref && String(t.ref).toLowerCase().includes(lowerFilter)) ||
                       (t.batchId && String(t.batchId).toLowerCase().includes(lowerFilter)) ||
                       (t.invoiceNumber && String(t.invoiceNumber).toLowerCase().includes(lowerFilter)) ||
                       (item && item.name.toLowerCase().includes(lowerFilter));
            });
        }

        const grouped = {};
        allHistoryItems.forEach(t => {
            const key = t.batchId;
            if (!key) return;
            if (!grouped[key]) grouped[key] = { date: t.date, type: t.type, batchId: key, transactions: [] };
            grouped[key].transactions.push(t);
        });

        Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(group => {
            const first = group.transactions[0];
            let details = '', statusTag = '', refNum = first.ref || first.batchId, typeDisplay = first.type.replace(/_/g, ' ').toUpperCase();
            const canEditInvoice = userCan('opEditInvoice') && first.type === 'receive' && (first.isApproved !== true && String(first.isApproved).toUpperCase() !== 'TRUE');

            let actionsHtml = `<button class="secondary small btn-view-tx" data-batch-id="${group.batchId}" data-type="${first.type}">View/Print</button>`;
            if(canEditInvoice){
                actionsHtml += `<button class="secondary small btn-edit-invoice" data-batch-id="${group.batchId}">Edit</button>`;
            }

            switch(first.type) {
                case 'receive':
                    details = `Received ${group.transactions.length} item(s) from <strong>${findByKey(state.suppliers, 'supplierCode', first.supplierCode)?.name || 'N/A'}</strong> to <strong>${findByKey(state.branches, 'branchCode', first.branchCode)?.name || 'N/A'}</strong>`;
                    refNum = first.invoiceNumber;
                    statusTag = first.isApproved === true || String(first.isApproved).toUpperCase() === 'TRUE' ? `<span class="status-tag status-approved">Approved</span>` : `<span class="status-tag status-pendingapproval">Pending Approval</span>`;
                    break;
                case 'return_out':
                    details = `Returned ${group.transactions.length} item(s) from <strong>${findByKey(state.branches, 'branchCode', first.fromBranchCode)?.name || 'N/A'}</strong> to <strong>${findByKey(state.suppliers, 'supplierCode', first.supplierCode)?.name || 'N/A'}</strong>`;
                    typeDisplay = "SUPPLIER RETURN";
                    break;
                case 'issue':
                    details = `Issued ${group.transactions.length} item(s) from <strong>${findByKey(state.branches, 'branchCode', first.fromBranchCode)?.name || 'N/A'}</strong> to <strong>${findByKey(state.sections, 'sectionCode', first.sectionCode)?.name || 'N/A'}</strong>`;
                    break;
                case 'transfer_out':
                case 'transfer_in':
                     details = `Transferred ${group.transactions.length} item(s) from <strong>${findByKey(state.branches, 'branchCode', first.fromBranchCode)?.name || 'N/A'}</strong> to <strong>${findByKey(state.branches, 'branchCode', first.toBranchCode)?.name || 'N/A'}</strong>`;
                     typeDisplay = "TRANSFER";
                     statusTag = `<span class="status-tag status-${(first.Status || '').toLowerCase().replace(/ /g,'')}">${first.Status}</span>`;
                     break;
                case 'po':
                    typeDisplay = "PURCHASE ORDER";
                    details = `Created PO for <strong>${findByKey(state.suppliers, 'supplierCode', first.supplierCode)?.name || 'N/A'}</strong>`;
                    statusTag = `<span class="status-tag status-${(first.Status || 'pending').toLowerCase().replace(/ /g,'')}">${first.Status}</span>`;
                    break;
                case 'adjustment_in':
                case 'adjustment_out':
                     typeDisplay = "STOCK ADJUSTMENT";
                     details = `Adjusted ${group.transactions.length} item(s) at <strong>${findByKey(state.branches, 'branchCode', first.fromBranchCode)?.name || 'N/A'}</strong>`;
                     break;
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date(first.date).toLocaleString()}</td><td>${typeDisplay}</td><td>${refNum}</td><td>${details}</td><td>${statusTag}</td><td><div class="action-buttons">${actionsHtml}</div></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderActivityLog() {
        const tbody = document.getElementById('table-activity-log').querySelector('tbody');
        tbody.innerHTML = '';
        if (!state.activityLog || state.activityLog.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No activity logged.</td></tr>';
            return;
        }
        state.activityLog.slice().reverse().forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date(log.Timestamp).toLocaleString()}</td><td>${log.User || 'N/A'}</td><td>${log.Action}</td><td>${log.Description}</td>`;
            tbody.appendChild(tr);
        });
    }
    
    const generateReceiveDocument = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; const branch = findByKey(state.branches, 'branchCode', data.branchCode) || { name: 'DELETED' }; let itemsHtml = '', totalValue = 0; data.items.forEach(item => { const itemTotal = item.quantity * item.cost; totalValue += itemTotal; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName}</td><td>${item.quantity.toFixed(2)}</td><td>${item.cost.toFixed(2)} EGP</td><td>${itemTotal.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card"><h2>Goods Received Note</h2><p><strong>GRN No:</strong> ${data.batchId}</p><p><strong>Invoice #:</strong> ${data.invoiceNumber}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><p><strong>Supplier:</strong> ${supplier.name} (${supplier.supplierCode || ''})</p><p><strong>Received at:</strong> ${branch.name} (${branch.branchCode || ''})</p><hr><h3>Items Received</h3><table><thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Cost/Unit</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold;">Total Value</td><td style="font-weight:bold;">${totalValue.toFixed(2)} EGP</td></tr></tfoot></table><hr><p><strong>Notes:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Signature:</strong> _________________________</p></div>`; printContent(content); };
    const generateTransferDocument = (data) => { const fromBranch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { name: 'DELETED' }; const toBranch = findByKey(state.branches, 'branchCode', data.toBranchCode) || { name: 'DELETED' }; let itemsHtml = ''; data.items.forEach(item => { const fullItem = findByKey(state.items, 'code', item.itemCode) || { code: 'N/A', name: 'DELETED', unit: 'N/A' }; itemsHtml += `<tr><td>${fullItem.code || item.itemCode}</td><td>${item.itemName || fullItem.name}</td><td>${parseFloat(item.quantity).toFixed(2)}</td><td>${fullItem.unit}</td></tr>`; }); const content = `<div class="printable-document card"><h2>Internal Transfer Order</h2><p><strong>Order ID:</strong> ${data.batchId}</p><p><strong>Reference:</strong> ${data.ref}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>From:</strong> ${fromBranch.name} (${fromBranch.branchCode || ''})</p><p><strong>To:</strong> ${toBranch.name} (${toBranch.branchCode || ''})</p><hr><h3>Items Transferred</h3><table><thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${itemsHtml}</tbody></table><hr><p><strong>Notes:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Sender:</strong> _________________</p><p><strong>Receiver:</strong> _________________</p></div>`; printContent(content); };
    const generateIssueDocument = (data) => { const fromBranch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { name: 'DELETED' }; const toSection = findByKey(state.sections, 'sectionCode', data.sectionCode) || { name: 'DELETED' }; let itemsHtml = ''; data.items.forEach(item => { const fullItem = findByKey(state.items, 'code', item.itemCode) || { name: 'DELETED', unit: 'N/A' }; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName || fullItem.name}</td><td>${item.quantity.toFixed(2)}</td><td>${fullItem.unit}</td></tr>`; }); const content = `<div class="printable-document card"><h2>Stock Issue Note</h2><p><strong>Issue Ref #:</strong> ${data.ref}</p><p><strong>Batch ID:</strong> ${data.batchId}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>From Branch:</strong> ${fromBranch.name} (${fromBranch.branchCode || ''})</p><p><strong>To Section:</strong> ${toSection.name} (${toSection.sectionCode || ''})</p><hr><h3>Items Issued</h3><table><thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${itemsHtml}</tbody></table><hr><p><strong>Notes:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Issued By:</strong> _________________</p><p><strong>Received By:</strong> _________________</p></div>`; printContent(content); };
    const generatePaymentVoucher = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; let invoicesHtml = ''; data.payments.forEach(p => { invoicesHtml += `<tr><td>${p.invoiceNumber}</td><td>${p.amount.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card"><h2>Payment Voucher</h2><p><strong>Voucher ID:</strong> ${data.payments[0].paymentId}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>Paid To:</strong> ${supplier.name} (${supplier.supplierCode || ''})</p><p><strong>Amount:</strong> ${data.totalAmount.toFixed(2)} EGP</p><p><strong>Method:</strong> ${data.method}</p><hr><h3>Payment Allocation</h3><table><thead><tr><th>Invoice #</th><th>Amount Paid</th></tr></thead><tbody>${invoicesHtml}</tbody></table><br><p><strong>Signature:</strong> _________________</p></div>`; printContent(content); };
    const generatePODocument = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; let itemsHtml = '', totalValue = 0; data.items.forEach(item => { const itemDetails = findByKey(state.items, 'code', item.itemCode) || {name: "N/A"}; const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); totalValue += itemTotal; itemsHtml += `<tr><td>${item.itemCode}</td><td>${itemDetails.name}</td><td>${(parseFloat(item.quantity) || 0).toFixed(2)}</td><td>${(parseFloat(item.cost) || 0).toFixed(2)} EGP</td><td>${itemTotal.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card"><h2>Purchase Order</h2><p><strong>PO No:</strong> ${data.poId || data.batchId}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><p><strong>Supplier:</strong> ${supplier.name} (${supplier.supplierCode || ''})</p><hr><h3>Items Ordered</h3><table><thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Cost/Unit</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold;">Total Value</td><td style="font-weight:bold;">${totalValue.toFixed(2)} EGP</td></tr></tfoot></table><hr><p><strong>Notes:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Authorized By:</strong> ${data.createdBy || state.currentUser.Name}</p></div>`; printContent(content); };
    const generateReturnDocument = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; const branch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { name: 'DELETED' }; let itemsHtml = '', totalValue = 0; data.items.forEach(item => { const itemTotal = item.quantity * item.cost; totalValue += itemTotal; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName}</td><td>${item.quantity.toFixed(2)}</td><td>${item.cost.toFixed(2)} EGP</td><td>${itemTotal.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card"><h2>Supplier Return Note</h2><p><strong>Credit Note Ref:</strong> ${data.ref}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><p><strong>Returned To:</strong> ${supplier.name}</p><p><strong>Returned From:</strong> ${branch.name}</p><hr><h3>Items Returned</h3><table><thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Cost/Unit</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold;">Total Value</td><td style="font-weight:bold;">${totalValue.toFixed(2)} EGP</td></tr></tfoot></table><hr><p><strong>Reason:</strong> ${data.notes || 'N/A'}</p></div>`; printContent(content); };
    const generateRequestIssueDocument = (data) => { const fromBranch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { name: 'DELETED' }; const toSection = findByKey(state.sections, 'sectionCode', data.sectionCode) || { name: 'DELETED' }; let itemsHtml = ''; data.items.forEach(item => { const fullItem = findByKey(state.items, 'code', item.itemCode) || { name: 'DELETED', unit: 'N/A' }; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName || fullItem.name}</td><td>${(item.quantity || 0).toFixed(2)}</td><td>${fullItem.unit}</td></tr>`; }); const content = `<div class="printable-document card"><h2>DRAFT Stock Issue Note (from Request)</h2><p><strong>Request ID:</strong> ${data.ref}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>From Branch:</strong> ${fromBranch.name} (${fromBranch.branchCode || ''})</p><p><strong>To Section:</strong> ${toSection.name} (${toSection.sectionCode || ''})</p><hr><h3>Items to be Issued</h3><table><thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${itemsHtml}</tbody></table><hr><p><strong>Notes:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Issued By:</strong> _________________</p><p><strong>Received By:</strong> _________________</p></div>`; printContent(content); };

// PART 4 OF 4: CALCULATION ENGINES, EVENT LISTENERS & INITIALIZATION
    function updateReceiveGrandTotal() { let grandTotal = 0; (state.currentReceiveList || []).forEach(item => { grandTotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); }); document.getElementById('receive-grand-total').textContent = `${grandTotal.toFixed(2)} EGP`; }
    function updateTransferGrandTotal() { let grandTotalQty = 0; (state.currentTransferList || []).forEach(item => { grandTotalQty += (parseFloat(item.quantity) || 0); }); document.getElementById('transfer-grand-total').textContent = grandTotalQty.toFixed(2); }
    function updateIssueGrandTotal() { let grandTotalQty = 0; (state.currentIssueList || []).forEach(item => { grandTotalQty += (parseFloat(item.quantity) || 0); }); document.getElementById('issue-grand-total').textContent = grandTotalQty.toFixed(2); }
    function updatePOGrandTotal() { let grandTotal = 0; (state.currentPOList || []).forEach(item => { grandTotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); }); document.getElementById('po-grand-total').textContent = `${grandTotal.toFixed(2)} EGP`; }
    function updatePOEditGrandTotal() { let grandTotal = 0; (state.currentEditingPOList || []).forEach(item => { grandTotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); }); document.getElementById('edit-po-grand-total').textContent = `${grandTotal.toFixed(2)} EGP`; }
    function updateReturnGrandTotal() { let grandTotal = 0; (state.currentReturnList || []).forEach(item => { grandTotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); }); document.getElementById('return-grand-total').textContent = `${grandTotal.toFixed(2)} EGP`; }

    async function loadAndRenderBackups() {
        const container = document.getElementById('backup-list-container');
        container.innerHTML = '<table><tbody><tr><td><div class="spinner" style="width:30px;height:30px;border-width:3px;"></div></td><td>Loading backups...</td></tr></tbody></table>';
        const result = await postData('listBackups', {}, null);
        if (result && result.data) {
            state.backups = result.data;
            if (state.backups.length === 0) {
                container.innerHTML = '<p>No backups found.</p>';
                return;
            }
            let tableHtml = `<table id="table-backups"><thead><tr><th>Backup Name</th><th>Date Created</th><th>Actions</th></tr></thead><tbody>`;
            state.backups.forEach(backup => {
                tableHtml += `
                    <tr>
                        <td>${backup.name}</td>
                        <td>${new Date(backup.dateCreated).toLocaleString()}</td>
                        <td>
                            <div class="action-buttons">
                                <a href="${backup.url}" target="_blank" rel="noopener noreferrer" class="secondary small" style="text-decoration: none;">Open</a>
                                <button class="danger small btn-restore" data-url="${backup.url}">Restore</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableHtml += '</tbody></table>';
            container.innerHTML = tableHtml;
        } else {
            container.innerHTML = '<p>Could not load backup list. Please check permissions or try again.</p>';
        }
    }
    
    async function loadAutoBackupSettings() {
        const toggle = document.getElementById('auto-backup-toggle');
        const frequencyContainer = document.getElementById('auto-backup-frequency-container');
        const statusEl = document.getElementById('auto-backup-status');
        
        statusEl.textContent = 'Checking status...';
        const result = await postData('getAutomaticBackupStatus', {}, null);
        
        if (result && typeof result.data.enabled !== 'undefined') {
            const isEnabled = result.data.enabled;
            toggle.checked = isEnabled;
            frequencyContainer.style.display = isEnabled ? 'block' : 'none';
            statusEl.textContent = isEnabled 
                ? 'Automatic backups are currently active.'
                : 'Automatic backups are currently disabled.';
        } else {
            statusEl.textContent = 'Could not retrieve automatic backup status.';
        }
    }
    
    async function handleAutoBackupToggle() {
        const toggle = document.getElementById('auto-backup-toggle');
        const frequency = document.getElementById('auto-backup-frequency').value;
        const frequencyContainer = document.getElementById('auto-backup-frequency-container');
        const statusEl = document.getElementById('auto-backup-status');
        
        const isEnabled = toggle.checked;
        frequencyContainer.style.display = isEnabled ? 'block' : 'none';
        
        statusEl.textContent = 'Updating settings...';
        const result = await postData('setAutomaticBackup', { enabled: isEnabled, frequency: frequency }, toggle);

        if (result) {
            showToast('Automatic backup settings updated!', 'success');
            statusEl.textContent = isEnabled
                ? `Automatic backups are now enabled (${frequency}).`
                : 'Automatic backups have been disabled.';
        } else {
            toggle.checked = !isEnabled;
            frequencyContainer.style.display = toggle.checked ? 'block' : 'none';
            statusEl.textContent = 'Failed to update settings. Please try again.';
        }
    }

    function openRestoreModal(backupFileId, backupFileName) {
        const modal = document.getElementById('restore-modal');
        const sheetListContainer = document.getElementById('restore-sheet-list');
        const confirmInput = document.getElementById('restore-confirmation-input');
        const confirmBtn = document.getElementById('btn-confirm-restore');
    
        document.getElementById('restore-filename-display').textContent = backupFileName;
        confirmBtn.dataset.backupFileId = backupFileId;
        
        confirmInput.value = '';
        confirmBtn.disabled = true;
    
        const coreSheets = [ 'Items', 'Suppliers', 'Branches', 'Sections', 'Transactions', 'Payments', 'PurchaseOrders', 'PurchaseOrderItems', 'ItemRequests', 'Users', 'Permissions' ];
        
        sheetListContainer.innerHTML = '';
        coreSheets.forEach(sheetName => {
            sheetListContainer.innerHTML += `<div class="form-group-checkbox"><input type="checkbox" id="restore-sheet-${sheetName}" name="restoreSheet" value="${sheetName}"><label for="restore-sheet-${sheetName}">${sheetName}</label></div>`;
        });
        
        const updateConfirmButtonState = () => {
            const sheetsSelected = document.querySelectorAll('#restore-sheet-list input:checked').length > 0;
            confirmBtn.disabled = !(confirmInput.value === 'RESTORE' && sheetsSelected);
        };

        confirmInput.addEventListener('input', updateConfirmButtonState);
        sheetListContainer.addEventListener('change', updateConfirmButtonState);
    
        modal.classList.add('active');
    }
    
    async function handleConfirmRestore(e) {
        const btn = e.target;
        const backupFileId = btn.dataset.backupFileId;
        const selectedSheets = Array.from(document.querySelectorAll('#restore-sheet-list input:checked')).map(el => el.value);
    
        if (selectedSheets.length === 0) {
            showToast('You must select at least one sheet to restore.', 'error');
            return;
        }
    
        const payload = {
            backupFileId: backupFileId,
            sheetsToRestore: selectedSheets
        };
    
        const result = await postData('restoreFromBackup', payload, btn);
    
        if (result) {
            showToast(result.data.message || 'Restore completed successfully!', 'success');
            closeModal();
            await reloadDataAndRefreshUI();
        }
    }

    async function handleTransactionSubmit(payload, buttonEl) {
        const action = payload.type === 'po' ? 'addPurchaseOrder' : 'addTransactionBatch';
        const result = await postData(action, payload, buttonEl);
        if (result) {
            let message = `${payload.type.replace(/_/g,' ').toUpperCase()} processed!`;
            if(payload.type === 'receive' || payload.type === 'po') message += " Submitted for approval.";
            if (payload.type === 'receive') { state.currentReceiveList = []; document.getElementById('form-receive-details').reset(); renderReceiveListTable(); }
            else if (payload.type === 'transfer_out') { generateTransferDocument(result.data); state.currentTransferList = []; document.getElementById('form-transfer-details').reset(); document.getElementById('transfer-ref').value = generateId('TRN'); renderTransferListTable(); }
            else if (payload.type === 'issue') { generateIssueDocument(result.data); state.currentIssueList = []; document.getElementById('form-issue-details').reset(); document.getElementById('issue-ref').value = generateId('ISN'); renderIssueListTable(); }
            else if (payload.type === 'po') { state.currentPOList = []; document.getElementById('form-po-details').reset(); document.getElementById('po-ref').value = generateId('PO'); renderPOListTable(); }
            else if (payload.type === 'return_out') { generateReturnDocument(result.data); state.currentReturnList = []; document.getElementById('form-return-details').reset(); renderReturnListTable(); }
            showToast(message, 'success');
            await reloadDataAndRefreshUI();
        }
    }

    const findByKey = (array, key, value) => (array || []).find(el => el && String(el[key]) === String(value));
    const generateId = (prefix) => `${prefix}-${Date.now()}`;
    const printContent = (content) => { document.getElementById('print-area').innerHTML = content; setTimeout(() => window.print(), 100); };
    const exportToExcel = (tableId, filename) => { try { const table = document.getElementById(tableId); if (!table) { showToast('Please generate a report first.', 'error'); return; } const wb = XLSX.utils.table_to_book(table, {sheet: "Sheet1"}); XLSX.writeFile(wb, filename); showToast('Exporting to Excel...', 'success'); } catch (err) { showToast('Excel export failed.', 'error'); Logger.error('Export Error:', err); } };
    
    const calculateStockLevels = () => {
        const stock = {};
        (state.branches || []).forEach(branch => { stock[branch.branchCode] = {}; });
        const sortedTransactions = [...(state.transactions || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
        const tempAvgCosts = {};
        sortedTransactions.forEach(t => {
            const isApproved = t.isApproved === true || String(t.isApproved).toUpperCase() === 'TRUE';
            if (t.type === 'receive' && !isApproved) return;
            
            const item = findByKey(state.items, 'code', t.itemCode);
            if (!item) return;
            const processStockUpdate = (branchCode, qtyChange, cost) => {
                if (!branchCode || !stock.hasOwnProperty(branchCode)) return;
                const current = stock[branchCode][t.itemCode] || { quantity: 0, avgCost: parseFloat(item.cost) || 0, itemName: item.name };
                if(qtyChange > 0) {
                    const totalValue = (current.quantity * current.avgCost) + (qtyChange * cost);
                    const totalQty = current.quantity + qtyChange;
                    const newAvgCost = totalQty > 0 ? totalValue / totalQty : current.avgCost;
                    stock[branchCode][t.itemCode] = { itemCode: t.itemCode, quantity: totalQty, avgCost: newAvgCost, itemName: item.name };
                    if (!tempAvgCosts[branchCode]) tempAvgCosts[branchCode] = {};
                    tempAvgCosts[branchCode][t.itemCode] = newAvgCost;
                } else {
                    current.quantity += qtyChange;
                    stock[branchCode][t.itemCode] = current;
                }
            };
            const qty = parseFloat(t.quantity) || 0;
            switch (t.type) {
                case 'receive': processStockUpdate(t.branchCode, qty, parseFloat(t.cost) || 0); break;
                case 'transfer_out': processStockUpdate(t.fromBranchCode, -qty); break;
                case 'issue': processStockUpdate(t.fromBranchCode, -qty); break;
                case 'return_out': processStockUpdate(t.fromBranchCode, -qty); break;
                case 'adjustment_out': processStockUpdate(t.fromBranchCode, -qty); break;
                case 'transfer_in':
                    const fromAvgCost = tempAvgCosts[t.fromBranchCode]?.[t.itemCode] || findByKey(state.items, 'code', t.itemCode)?.cost || 0;
                    processStockUpdate(t.toBranchCode, qty, parseFloat(fromAvgCost));
                    break;
                case 'adjustment_in':
                    processStockUpdate(t.fromBranchCode, qty, parseFloat(t.cost) || 0);
                    break;
            }
        });
        return stock;
    };

    const calculateSupplierFinancials = () => {
        const financials = {};
        (state.suppliers || []).forEach(s => { financials[s.supplierCode] = { supplierCode: s.supplierCode, supplierName: s.name, totalBilled: 0, totalPaid: 0, totalCredited: 0, balance: 0, invoices: {}, events: [] }; });
        (state.transactions || []).forEach(t => {
            const isApproved = t.isApproved === true || String(t.isApproved).toUpperCase() === 'TRUE';
            if (!t.supplierCode || !financials[t.supplierCode] || t.cost === undefined) return;
            const value = (parseFloat(t.quantity) || 0) * (parseFloat(t.cost) || 0);
            if (t.type === 'receive' && isApproved) {
                financials[t.supplierCode].totalBilled += value;
                const invNum = t.invoiceNumber;
                if (!financials[t.supplierCode].invoices[invNum]) { financials[t.supplierCode].invoices[invNum] = { number: invNum, date: t.date, total: 0, paid: 0 }; }
                financials[t.supplierCode].invoices[invNum].total += value;
            } else if (t.type === 'return_out') {
                financials[t.supplierCode].totalCredited += value;
            }
        });
        (state.payments || []).forEach(p => { 
            if (financials[p.supplierCode]) { 
                const amount = parseFloat(p.amount) || 0;
                if (p.method === 'OPENING BALANCE') {
                    financials[p.supplierCode].totalBilled += amount;
                } else {
                    financials[p.supplierCode].totalPaid += amount;
                }
                
                if (p.invoiceNumber && financials[p.supplierCode].invoices[p.invoiceNumber]) { 
                    financials[p.supplierCode].invoices[p.invoiceNumber].paid += amount;
                } else if (p.method === 'OPENING BALANCE') {
                    financials[p.supplierCode].invoices[p.invoiceNumber] = { number: p.invoiceNumber, date: p.date, total: amount, paid: 0 };
                }
            } 
        });
        Object.values(financials).forEach(s => {
            s.balance = s.totalBilled - s.totalPaid - s.totalCredited;
            Object.values(s.invoices).forEach(inv => { inv.balance = inv.total - inv.paid; if (Math.abs(inv.balance) < 0.01) { inv.status = 'Paid'; } else if (inv.paid > 0) { inv.status = 'Partial'; } else { inv.status = 'Unpaid'; } });
            const allEvents = [
                ...Object.values(s.invoices).map(i => ({ date: i.date, type: 'Invoice/OB', ref: i.number, debit: i.total, credit: 0 })),
                ...(state.transactions || []).filter(t => t.type === 'return_out' && t.supplierCode === s.supplierCode).map(t => ({ date: t.date, type: 'Return (Credit)', ref: t.ref, debit: 0, credit: (parseFloat(t.quantity) || 0) * (parseFloat(t.cost) || 0) })),
                ...(state.payments || []).filter(p => p.supplierCode === s.supplierCode && p.method !== 'OPENING BALANCE').map(p => ({ date: p.date, type: 'Payment', ref: p.paymentId, debit: 0, credit: (parseFloat(p.amount) || 0) }))
            ];
            s.events = allEvents.sort((a,b) => new Date(a.date) - new Date(b.date));
        });
        financials.allInvoices = {}; Object.values(financials).forEach(s => { Object.assign(financials.allInvoices, s.invoices); }); return financials;
    };
    
    const calculateHistoricalCosts = () => {
        const costSnapshots = {}; 
        const stock = {}; 
        
        (state.branches || []).forEach(branch => { stock[branch.branchCode] = {}; });
        
        const sortedTransactions = [...(state.transactions || [])]
            .filter(t => t.type) 
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    
        sortedTransactions.forEach(t => {
            const isApproved = t.isApproved === true || String(t.isApproved).toUpperCase() === 'TRUE';
            if (t.type === 'receive' && !isApproved) return;

            const item = findByKey(state.items, 'code', t.itemCode);
            if (!item) return;
    
            const qty = parseFloat(t.quantity) || 0;
            let branchCode, costForUpdate, costForSnapshot;
    
            switch (t.type) {
                case 'receive':
                case 'adjustment_in':
                    branchCode = t.branchCode || t.fromBranchCode;
                    costForUpdate = parseFloat(t.cost) || 0;
                    costForSnapshot = costForUpdate;
                    break;
                case 'transfer_in':
                    branchCode = t.toBranchCode;
                    costForUpdate = costSnapshots[`${t.batchId}-${t.itemCode}`] || (stock[t.fromBranchCode]?.[t.itemCode]?.avgCost) || item.cost;
                    costForSnapshot = costForUpdate;
                    break;
                case 'issue':
                case 'return_out':
                case 'transfer_out':
                case 'adjustment_out':
                    branchCode = t.fromBranchCode;
                    costForUpdate = null; 
                    costForSnapshot = stock[branchCode]?.[t.itemCode]?.avgCost || parseFloat(item.cost) || 0;
                    break;
                default:
                    return;
            }
            
            if (!branchCode || !stock[branchCode]) return;
            
            costSnapshots[`${t.batchId}-${t.itemCode}`] = costForSnapshot;
    
            const currentStock = stock[branchCode][t.itemCode] || { quantity: 0, avgCost: parseFloat(item.cost) || 0 };
    
            if (t.type === 'receive' || t.type === 'transfer_in' || t.type === 'adjustment_in') {
                const totalValue = (currentStock.quantity * currentStock.avgCost) + (qty * costForUpdate);
                const totalQty = currentStock.quantity + qty;
                const newAvgCost = totalQty > 0 ? totalValue / totalQty : currentStock.avgCost;
                stock[branchCode][t.itemCode] = { quantity: totalQty, avgCost: newAvgCost };
            } else {
                stock[branchCode][t.itemCode] = { quantity: currentStock.quantity - qty, avgCost: currentStock.avgCost };
            }
        });
    
        return costSnapshots;
    };

    const populateOptions = (el, data, ph, valueKey, textKey, textKey2) => { 
        if (!el) {
            console.warn(`populateOptions failed: element is null for placeholder "${ph}"`);
            return;
        }
        el.innerHTML = `<option value="">${ph}</option>`; 
        (data || []).forEach(item => { el.innerHTML += `<option value="${item[valueKey]}">${item[textKey]}${textKey2 && item[textKey2] ? ' (' + item[textKey2] + ')' : ''}</option>`; }); 
    };
    
    function getVisibleBranchesForCurrentUser() { if (!state.currentUser) return []; if (userCan('viewAllBranches')) { return state.branches; } if (state.currentUser.AssignedBranchCode) { return state.branches.filter(b => String(b.branchCode) === String(state.currentUser.AssignedBranchCode)); } return []; }
    
    function applyUserUIConstraints() {
        if (!state.currentUser) return;
        const branchCode = state.currentUser.AssignedBranchCode;
        const sectionCode = state.currentUser.AssignedSectionCode;
        if (branchCode) {
            ['receive-branch', 'issue-from-branch', 'transfer-from-branch', 'return-branch', 'adjustment-branch'].forEach(id => {
                const el = document.getElementById(id);
                if (el && !userCan('viewAllBranches')) { el.value = branchCode; el.disabled = true; el.dispatchEvent(new Event('change')); }
            });
            if (!userCan('viewAllBranches')) {
                ['branch-consumption-select', 'resupply-branch-filter', 'tx-filter-branch'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.value = branchCode; el.disabled = true; }
                });
            }
        }
        if (sectionCode && !userCan('viewAllBranches')) {
            ['section-consumption-select', 'tx-filter-section'].forEach(id => {
                const el = document.getElementById(id);
                if(el) { el.value = sectionCode; el.disabled = true; }
            });
        }
    }

    const refreshViewData = async (viewId) => {
        if (!state.currentUser) return;
        Logger.debug(`Refreshing view: ${viewId}`);

        switch(viewId) {
            case 'dashboard':
                const stock = calculateStockLevels();
                document.getElementById('dashboard-total-items').textContent = (state.items || []).length;
                document.getElementById('dashboard-total-suppliers').textContent = (state.suppliers || []).length;
                document.getElementById('dashboard-total-branches').textContent = (state.branches || []).length;
                let totalValue = 0;
                Object.values(stock).forEach(bs => Object.values(bs).forEach(i => totalValue += i.quantity * i.avgCost));
                document.getElementById('dashboard-total-value').textContent = `${totalValue.toFixed(2)} EGP`;
                break;
            case 'setup':
                document.getElementById('form-add-item').parentElement.style.display = userCan('createItem') ? 'block' : 'none';
                document.getElementById('form-add-supplier').parentElement.style.display = userCan('createSupplier') ? 'block' : 'none';
                document.getElementById('form-add-branch').parentElement.style.display = userCan('createBranch') ? 'block' : 'none';
                document.getElementById('form-add-section').parentElement.style.display = userCan('createSection') ? 'block' : 'none';
                populateOptions(document.getElementById('item-supplier'), state.suppliers, 'Select Supplier', 'supplierCode', 'name');
                break;
            case 'backup':
                 loadAndRenderBackups();
                 loadAutoBackupSettings();
                 break;
            case 'master-data':
                document.querySelector('[data-subview="items"]').style.display = userCan('editItem') || userCan('createItem') ? 'inline-block' : 'none';
                document.querySelector('[data-subview="suppliers"]').style.display = userCan('editSupplier') || userCan('createSupplier') ? 'inline-block' : 'none';
                document.querySelector('[data-subview="branches"]').style.display = userCan('editBranch') || userCan('createBranch') ? 'inline-block' : 'none';
                document.querySelector('[data-subview="sections"]').style.display = userCan('editSection') || userCan('createSection') ? 'inline-block' : 'none';
                renderItemsTable(); renderSuppliersTable(); renderBranchesTable(); renderSectionsTable();
                break;
            case 'operations':
                document.querySelector('[data-subview="receive"]').style.display = userCan('opReceive') ? 'inline-block' : 'none';
                document.querySelector('[data-subview="issue"]').style.display = userCan('opIssue') ? 'inline-block' : 'none';
                document.querySelector('[data-subview="transfer"]').style.display = userCan('opTransfer') ? 'inline-block' : 'none';
                document.querySelector('[data-subview="return"]').style.display = userCan('opReturn') ? 'inline-block' : 'none';
                const canAdjustStock = userCan('opStockAdjustment');
                const canAdjustFinance = userCan('opFinancialAdjustment');
                document.querySelector('[data-subview="adjustments"]').style.display = canAdjustStock || canAdjustFinance ? 'inline-block' : 'none';
                document.getElementById('stock-adjustment-card').style.display = canAdjustStock ? 'block' : 'none';
                document.getElementById('stock-adjustment-list-card').style.display = canAdjustStock ? 'block' : 'none';
                document.getElementById('financial-adjustment-card').style.display = canAdjustFinance ? 'block' : 'none';
                populateOptions(document.getElementById('receive-supplier'), state.suppliers, 'Select Supplier', 'supplierCode', 'name');
                populateOptions(document.getElementById('receive-branch'), state.branches, 'Select Branch', 'branchCode', 'name');
                populateOptions(document.getElementById('transfer-from-branch'), state.branches, 'Select Source', 'branchCode', 'name');
                populateOptions(document.getElementById('transfer-to-branch'), state.branches, 'Select Destination', 'branchCode', 'name');
                populateOptions(document.getElementById('issue-from-branch'), state.branches, 'Select Source', 'branchCode', 'name');
                populateOptions(document.getElementById('issue-to-section'), state.sections, 'Select Destination', 'sectionCode', 'name');
                populateOptions(document.getElementById('return-supplier'), state.suppliers, 'Select Supplier', 'supplierCode', 'name');
                populateOptions(document.getElementById('return-branch'), state.branches, 'Select Branch', 'branchCode', 'name');
                populateOptions(document.getElementById('adjustment-branch'), state.branches, 'Select Branch', 'branchCode', 'name');
                populateOptions(document.getElementById('fin-adj-supplier'), state.suppliers, 'Select Supplier', 'supplierCode', 'name');
                const openPOs = (state.purchaseOrders || []).filter(po => po.Status === 'Approved');
                populateOptions(document.getElementById('receive-po-select'), openPOs, 'Select a Purchase Order', 'poId', 'poId', 'supplierCode');
                document.getElementById('issue-ref').value = generateId('ISN'); document.getElementById('transfer-ref').value = generateId('TRN');
                renderReceiveListTable(); renderIssueListTable(); renderTransferListTable(); renderReturnListTable(); renderPendingTransfers(); renderInTransitReport(); renderAdjustmentListTable();
                break;
            case 'purchasing':
                 document.querySelector('[data-subview="create-po"]').style.display = userCan('opCreatePO') ? 'inline-block' : 'none';
                 document.querySelector('[data-subview="view-pos"]').style.display = userCan('opCreatePO') || userCan('opApproveFinancials') ? 'inline-block' : 'none';
                 document.querySelector('[data-subview="pending-financial-approval"]').style.display = userCan('opApproveFinancials') ? 'inline-block' : 'none';
                 populateOptions(document.getElementById('po-supplier'), state.suppliers, 'Select Supplier', 'supplierCode', 'name');
                 document.getElementById('po-ref').value = generateId('PO');
                 renderPOListTable(); renderPurchaseOrdersViewer(); renderPendingFinancials();
                 break;
            case 'requests':
                document.querySelector('[data-subview="my-requests"]').style.display = userCan('opRequestItems') ? 'inline-block' : 'none';
                document.querySelector('[data-subview="pending-approval"]').style.display = userCan('opApproveIssueRequest') || userCan('opApproveResupplyRequest') ? 'inline-block' : 'none';
                renderRequestListTable(); renderMyRequests(); renderPendingRequests();
                break;
            case 'payments':
                populateOptions(document.getElementById('payment-supplier-select'), state.suppliers, 'Select Supplier', 'supplierCode', 'name');
                renderPaymentList();
                document.getElementById('btn-select-invoices').disabled = true;
                break;
            case 'reports':
                populateOptions(document.getElementById('supplier-statement-select'), state.suppliers, 'Select a Supplier', 'supplierCode', 'name');
                populateOptions(document.getElementById('branch-consumption-select'), getVisibleBranchesForCurrentUser(), 'Select a Branch', 'branchCode', 'name');
                populateOptions(document.getElementById('section-consumption-select'), state.sections, 'Select a Section', 'sectionCode', 'name');
                populateOptions(document.getElementById('resupply-branch-filter'), getVisibleBranchesForCurrentUser(), 'All Branches', 'branchCode', 'name');
                populateOptions(document.getElementById('branch-consumption-item-filter'), state.items, 'All Items', 'code', 'name');
                populateOptions(document.getElementById('section-consumption-item-filter'), state.items, 'All Items', 'code', 'name');
                break;
            case 'stock-levels':
                document.getElementById('stock-levels-title').textContent = userCan('viewAllBranches') ? 'Stock by Item (All Branches)' : 'Stock by Item (Your Branch)';
                renderItemCentricStockView();
                document.getElementById('item-inquiry-search').value = ''; renderItemInquiry('');
                document.getElementById('stock-levels-search').value = '';
                break;
            case 'transaction-history': 
                populateOptions(document.getElementById('tx-filter-branch'), state.branches, 'All Branches', 'branchCode', 'name');
                populateOptions(document.getElementById('tx-filter-section'), state.sections, 'All Sections', 'sectionCode', 'name');
                populateOptions(document.getElementById('tx-filter-supplier'), state.suppliers, 'All Suppliers', 'supplierCode', 'name');
                const txTypes = ['receive', 'issue', 'transfer_out', 'transfer_in', 'return_out', 'po', 'adjustment_in', 'adjustment_out'];
                populateOptions(document.getElementById('tx-filter-type'), txTypes.map(t => ({'type': t, 'name': t.replace(/_/g, ' ').toUpperCase()})), 'All Types', 'type', 'name');
                renderTransactionHistory({
                    startDate: document.getElementById('tx-filter-start-date').value,
                    endDate: document.getElementById('tx-filter-end-date').value,
                    type: document.getElementById('tx-filter-type').value,
                    branch: document.getElementById('tx-filter-branch').value,
                    searchTerm: document.getElementById('transaction-search').value,
                }); 
                break;
            case 'user-management':
                const result = await postData('getAllUsersAndRoles', {}, null);
                if (result) { state.allUsers = result.data.users; state.allRoles = result.data.roles; renderUserManagementUI(); }
                break;
            case 'activity-log':
                renderActivityLog();
                break;
        }
        applyUserUIConstraints();
    };

    async function reloadDataAndRefreshUI() { 
        Logger.info('Reloading data...'); 
        const { username, loginCode } = state; 
        if (!username || !loginCode) { logout(); return; } 
        const currentView = document.querySelector('.nav-item a.active')?.dataset.view || 'dashboard'; 
        setButtonLoading(true, globalRefreshBtn); 
        try { 
            const response = await fetch(`${SCRIPT_URL}?username=${encodeURIComponent(username)}&loginCode=${encodeURIComponent(loginCode)}`); 
            if (!response.ok) throw new Error('Failed to reload data.'); 
            const data = await response.json(); 
            if (data.status === 'error') throw new Error(data.message); 
            Object.keys(data).forEach(key => { 
                if(key !== 'user') state[key] = data[key] || state[key]; 
            }); 
            updateUserBranchDisplay(); 
            updatePendingRequestsWidget(); 
            await refreshViewData(currentView); 
            Logger.info('Reload complete.'); 
            showToast('Data refreshed!', 'success'); 
        } catch (err) { 
            Logger.error('Data reload failed:', err); 
            showToast('Could not refresh data. Please try again.', 'error'); 
        } finally { 
            setButtonLoading(false, globalRefreshBtn); 
        } 
    }
    
    function renderUserManagementUI() {
        const usersTbody = document.getElementById('table-users').querySelector('tbody');
        usersTbody.innerHTML = '';
        (state.allUsers || []).forEach(user => {
            const tr = document.createElement('tr');
            const assigned = findByKey(state.branches, 'branchCode', user.AssignedBranchCode)?.name || findByKey(state.sections, 'sectionCode', user.AssignedSectionCode)?.name || 'N/A';
            const isDisabled = user.isDisabled === true || String(user.isDisabled).toUpperCase() === 'TRUE';
            tr.innerHTML = `<td>${user.Username}</td><td>${user.Name}</td><td>${user.RoleName}</td><td>${assigned}</td><td><span class="status-tag ${isDisabled ? 'status-rejected' : 'status-approved'}">${isDisabled ? 'Disabled' : 'Active'}</span></td><td><button class="secondary small btn-edit" data-type="user" data-id="${user.Username}">Edit</button></td>`;
            usersTbody.appendChild(tr);
        });
        const rolesTbody = document.getElementById('table-roles').querySelector('tbody');
        rolesTbody.innerHTML = '';
        (state.allRoles || []).forEach(role => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${role.RoleName}</td><td><button class="secondary small btn-edit" data-type="role" data-id="${role.RoleName}">Edit</button></td>`;
            rolesTbody.appendChild(tr);
        });
    }

    function renderPurchaseOrdersViewer() {
        const tbody = document.getElementById('table-po-viewer').querySelector('tbody');
        tbody.innerHTML = '';
        (state.purchaseOrders || []).slice().reverse().forEach(po => {
            const supplier = findByKey(state.suppliers, 'supplierCode', po.supplierCode);
            const items = (state.purchaseOrderItems || []).filter(item => item.poId === po.poId);
            const tr = document.createElement('tr');
            const canEditPO = po.Status === 'Pending Approval' && userCan('opCreatePO');
            tr.innerHTML = `
                <td>${po.poId}</td>
                <td>${new Date(po.date).toLocaleDateString()}</td>
                <td>${supplier?.name || po.supplierCode}</td>
                <td>${items.length}</td>
                <td>${(parseFloat(po.totalValue) || 0).toFixed(2)} EGP</td>
                <td><span class="status-tag status-${(po.Status || 'pending').toLowerCase().replace(/ /g,'')}">${po.Status}</span></td>
                <td><div class="action-buttons">
                    <button class="secondary small btn-view-tx" data-batch-id="${po.poId}" data-type="po">View/Print</button>
                    ${canEditPO ? `<button class="secondary small btn-edit-po" data-po-id="${po.poId}">Edit</button>` : ''}
                </div></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderPendingFinancials() {
        const tbody = document.getElementById('table-pending-financial-approval').querySelector('tbody');
        tbody.innerHTML = '';
        
        const pendingPOs = (state.purchaseOrders || []).filter(po => po.Status === 'Pending Approval');
        
        const pendingReceivesGroups = {};
        (state.transactions || []).filter(t => t.type === 'receive' && (t.isApproved === false || String(t.isApproved).toUpperCase() === 'FALSE')).forEach(t => {
            if (!pendingReceivesGroups[t.batchId]) {
                pendingReceivesGroups[t.batchId] = {
                    date: t.date,
                    txType: 'receive',
                    ref: t.invoiceNumber,
                    batchId: t.batchId,
                    details: `GRN from ${findByKey(state.suppliers, 'supplierCode', t.supplierCode)?.name || 'N/A'}`,
                    totalValue: 0
                };
            }
            pendingReceivesGroups[t.batchId].totalValue += (parseFloat(t.quantity) || 0) * (parseFloat(t.cost) || 0);
        });

        let allPending = [
            ...pendingPOs.map(po => ({...po, txType: 'po', ref: po.poId, value: po.totalValue, details: `PO for ${findByKey(state.suppliers, 'supplierCode', po.supplierCode)?.name || 'N/A'}`})),
            ...Object.values(pendingReceivesGroups).map(rcv => ({...rcv, value: rcv.totalValue}))
        ];

        if (allPending.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No items are pending financial approval.</td></tr>';
            return;
        }

        allPending.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(item.date).toLocaleDateString()}</td>
                <td>${item.txType.toUpperCase()}</td>
                <td>${item.ref}</td>
                <td>${item.details}</td>
                <td>${(parseFloat(item.value) || 0).toFixed(2)} EGP</td>
                <td>
                    <div class="action-buttons">
                        <button class="primary small btn-approve-financial" data-id="${item.txType === 'po' ? item.poId : item.batchId}" data-type="${item.txType}">Approve</button>
                        <button class="danger small btn-reject-financial" data-id="${item.txType === 'po' ? item.poId : item.batchId}" data-type="${item.txType}">Reject</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    function renderMyRequests() {
        const tbody = document.getElementById('table-my-requests-history').querySelector('tbody');
        tbody.innerHTML = '';
        const myRequests = (state.itemRequests || []).filter(r => r.RequestedBy === state.currentUser.Name);
        const grouped = myRequests.reduce((acc, req) => {
            if (!acc[req.RequestID]) acc[req.RequestID] = { ...req, items: [] };
            acc[req.RequestID].items.push(req);
            return acc;
        }, {});
        
        Object.values(grouped).reverse().forEach(group => {
            const first = group;
            const tr = document.createElement('tr');
            const itemsSummary = group.items.map(i => `${i.Quantity} / ${i.IssuedQuantity !== '' && i.IssuedQuantity !== null ? i.IssuedQuantity : 'N/A'}`).join(', ');

            tr.innerHTML = `
                <td>${first.RequestID}</td>
                <td>${new Date(first.Date).toLocaleDateString()}</td>
                <td>${first.Type}</td>
                <td>${itemsSummary}</td>
                <td><span class="status-tag status-${first.Status.toLowerCase()}">${first.Status}</span></td>
                <td>${first.StatusNotes || ''}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderPendingRequests() {
        const tbody = document.getElementById('table-pending-requests').querySelector('tbody');
        tbody.innerHTML = '';
        const pending = (state.itemRequests || []).filter(r => r.Status === 'Pending' && (userCan('viewAllBranches') || r.ToBranch === state.currentUser.AssignedBranchCode));
        const grouped = pending.reduce((acc, req) => {
            if (!acc[req.RequestID]) acc[req.RequestID] = [];
            acc[req.RequestID].push(req);
            return acc;
        }, {});

        Object.values(grouped).forEach(group => {
            const first = group[0];
            const fromSection = findByKey(state.sections, 'sectionCode', first.FromSection)?.name || first.FromSection;
            const toBranch = findByKey(state.branches, 'branchCode', first.ToBranch)?.name || first.ToBranch;
            const itemsSummary = group.map(i => `${i.Quantity} x ${findByKey(state.items, 'code', i.ItemCode)?.name || i.ItemCode}`).join('<br>');
            const tr = document.createElement('tr');
            let canApprove = (first.Type === 'issue' && userCan('opApproveIssueRequest')) || (first.Type === 'resupply' && userCan('opApproveResupplyRequest'));
            let approveBtnText = first.Type === 'issue' ? 'Edit & Approve' : 'Approve';

            tr.innerHTML = `
                <td>${first.RequestID}</td>
                <td>${new Date(first.Date).toLocaleString()}</td>
                <td>${first.Type}</td>
                <td>${first.RequestedBy}</td>
                <td>From: ${fromSection}<br>To: ${toBranch}</td>
                <td>${itemsSummary}</td>
                <td>
                    <div class="action-buttons">
                        <button class="primary small btn-approve-request" data-id="${first.RequestID}" ${!canApprove ? 'disabled' : ''}>${approveBtnText}</button>
                        <button class="danger small btn-reject-request" data-id="${first.RequestID}" ${!canApprove ? 'disabled' : ''}>Reject</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderPendingTransfers() {
        const container = document.getElementById('pending-transfers-card');
        const tbody = document.getElementById('table-pending-transfers').querySelector('tbody');
        tbody.innerHTML = '';
        const groupedTransfers = {};
        (state.transactions || []).filter(t => t.type === 'transfer_out' && t.Status === 'In Transit').forEach(t => {
            if (!groupedTransfers[t.batchId]) groupedTransfers[t.batchId] = { ...t, items: [] };
            groupedTransfers[t.batchId].items.push(t);
        });
        const visibleTransfers = Object.values(groupedTransfers).filter(t => userCan('viewAllBranches') || t.toBranchCode === state.currentUser.AssignedBranchCode);
        
        if (visibleTransfers.length === 0) {
            container.style.display = 'none'; return;
        }
        tbody.innerHTML = '';
        visibleTransfers.forEach(t => {
            const tr = document.createElement('tr');
            const fromBranch = findByKey(state.branches, 'branchCode', t.fromBranchCode)?.name || t.fromBranchCode;
            tr.innerHTML = `<td>${new Date(t.date).toLocaleString()}</td><td>${fromBranch}</td><td>${t.ref}</td><td>${t.items.length}</td><td><button class="primary small btn-receive-transfer" data-batch-id="${t.batchId}">View/Confirm</button></td>`;
            tbody.appendChild(tr);
        });
        container.style.display = 'block';
    }

    function renderInTransitReport() {
        const tbody = document.getElementById('table-in-transit').querySelector('tbody');
        tbody.innerHTML = '';
        const groupedTransfers = {};
        (state.transactions || []).filter(t => t.type === 'transfer_out').forEach(t => {
            if (!groupedTransfers[t.batchId]) groupedTransfers[t.batchId] = { ...t, items: [] };
            groupedTransfers[t.batchId].items.push(t);
        });
        const visibleTransfers = Object.values(groupedTransfers).filter(t => userCan('viewAllBranches') || t.toBranchCode === state.currentUser.AssignedBranchCode || t.fromBranchCode === state.currentUser.AssignedBranchCode);
        
        visibleTransfers.forEach(t => {
            const tr = document.createElement('tr');
            const fromBranch = findByKey(state.branches, 'branchCode', t.fromBranchCode)?.name || t.fromBranchCode;
            const toBranch = findByKey(state.branches, 'branchCode', t.toBranchCode)?.name || t.toBranchCode;
            const canManage = (userCan('viewAllBranches') || t.fromBranchCode === state.currentUser.AssignedBranchCode) && t.Status === 'In Transit';
            const actions = canManage ? `<div class="action-buttons"><button class="secondary small btn-edit-transfer" data-batch-id="${t.batchId}">Edit</button><button class="danger small btn-cancel-transfer" data-batch-id="${t.batchId}">Cancel</button></div>` : 'N/A';
            tr.innerHTML = `<td>${new Date(t.date).toLocaleString()}</td><td>${fromBranch}</td><td>${toBranch}</td><td>${t.ref}</td><td>${t.items.length}</td><td><span class="status-tag status-${t.Status.toLowerCase().replace(/ /g,'')}">${t.Status}</span></td><td>${actions}</td>`;
            tbody.appendChild(tr);
        });
    }
    
    function updatePendingRequestsWidget() {
        const widget = document.getElementById('pending-requests-widget');
        if (!userCan('opApproveIssueRequest') && !userCan('opApproveResupplyRequest')) {
            widget.style.display = 'none';
            return;
        }
        const pendingRequests = (state.itemRequests || []).filter(r => r.Status === 'Pending' && (userCan('viewAllBranches') || r.ToBranch === state.currentUser.AssignedBranchCode));
        const count = new Set(pendingRequests.map(r => r.RequestID)).size;
        
        if(count > 0) {
            document.getElementById('pending-requests-count').textContent = count;
            widget.style.display = 'flex';
        } else {
            widget.style.display = 'none';
        }
    }

    function setupSearch(inputId, renderFn, dataKey, searchKeys) { const searchInput = document.getElementById(inputId); if (!searchInput) return; searchInput.addEventListener('input', e => { const searchTerm = e.target.value.toLowerCase(); const dataToFilter = state[dataKey] || []; renderFn(searchTerm ? dataToFilter.filter(item => searchKeys.some(key => item[key] && String(item[key]).toLowerCase().includes(searchTerm))) : dataToFilter); }); }
    
    function attachSubNavListeners() { document.querySelectorAll('.sub-nav').forEach(nav => { if(nav.closest('#history-modal')) return; nav.addEventListener('click', e => { if (!e.target.classList.contains('sub-nav-item')) return; const subviewId = e.target.dataset.subview; const parentView = e.target.closest('.view'); if (!parentView) return; parentView.querySelectorAll('.sub-nav-item').forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); parentView.querySelectorAll('.sub-view').forEach(view => view.classList.remove('active')); const subViewToShow = parentView.querySelector(`#subview-${subviewId}`); if (subViewToShow) subViewToShow.classList.add('active'); }); }); }
    
    function attachEventListeners() {
        btnLogout.addEventListener('click', logout);
        globalRefreshBtn.addEventListener('click', reloadDataAndRefreshUI);
        
        document.getElementById('btn-create-backup').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            if (confirm('This will create a full, manual backup of the current spreadsheet. Continue?')) {
                const result = await postData('createBackup', {}, btn);
                if (result && result.data) {
                    showToast(`Backup created: ${result.data.fileName}`, 'success');
                    await loadAndRenderBackups();
                }
            }
        });

        document.getElementById('backup-list-container').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (btn && btn.classList.contains('btn-restore')) {
                const backupFileId = findByKey(state.backups, 'url', btn.dataset.url)?.id;
                const backupFileName = findByKey(state.backups, 'url', btn.dataset.url)?.name;
                if (backupFileId) {
                    openRestoreModal(backupFileId, backupFileName);
                } else {
                    showToast('Could not find backup file ID.', 'error');
                }
            }
        });
        
        document.getElementById('auto-backup-toggle').addEventListener('change', handleAutoBackupToggle);
        document.getElementById('auto-backup-frequency').addEventListener('change', handleAutoBackupToggle);
        document.getElementById('btn-confirm-restore').addEventListener('click', handleConfirmRestore);

        document.querySelectorAll('#main-nav a:not(#btn-logout)').forEach(link => { link.addEventListener('click', e => { e.preventDefault(); showView(link.dataset.view); }); });
        
        mainContent.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.dataset.context) { openItemSelectorModal(e); }
            if (btn.id === 'btn-select-invoices') { openInvoiceSelectorModal(); }
            if (btn.classList.contains('btn-edit')) { openEditModal(btn.dataset.type, btn.dataset.id); }
            if (btn.classList.contains('btn-history')) { openHistoryModal(btn.dataset.id); }
            if (btn.id === 'btn-add-new-user') { openEditModal('user', null); }
            if (btn.id === 'btn-add-new-role') { const roleName = prompt("Enter new role name:"); if(roleName) { postData('addRole', { RoleName: roleName }, btn).then(res => res && reloadDataAndRefreshUI()); } }
            if (btn.classList.contains('btn-view-tx')) {
                 const batchId = btn.dataset.batchId;
                 const type = btn.dataset.type;
                 let data, items;
                 
                 switch(type) {
                     case 'po':
                         data = findByKey(state.purchaseOrders, 'poId', batchId);
                         items = (state.purchaseOrderItems || []).filter(i => i.poId === batchId);
                         if (data && items) generatePODocument({ ...data, items });
                         break;
                     default:
                         const transactionGroup = state.transactions.filter(t => t.batchId === batchId);
                         if (transactionGroup.length > 0) {
                             const first = transactionGroup[0];
                             data = { ...first, items: transactionGroup.map(t => ({...t, itemName: findByKey(state.items, 'code', t.itemCode)?.name })) };
                             if (type === 'receive') generateReceiveDocument(data);
                             else if (type.startsWith('transfer')) generateTransferDocument(data);
                             else if (type === 'issue') generateIssueDocument(data);
                             else if (type === 'return_out') generateReturnDocument(data);
                         }
                         break;
                 }
            }
            if (btn.classList.contains('btn-receive-transfer')) { openViewTransferModal(btn.dataset.batchId); }
            if (btn.classList.contains('btn-edit-transfer')) { openTransferEditModal(btn.dataset.batchId); }
            if (btn.classList.contains('btn-cancel-transfer')) { const batchId = btn.dataset.batchId; if (confirm(`Are you sure you want to cancel transfer ${batchId}?`)) { postData('cancelTransfer', { batchId }, btn).then(res => res && reloadDataAndRefreshUI()); } }
            if(btn.classList.contains('btn-approve-request')) { openApproveRequestModal(btn.dataset.id); } 
            if (btn.classList.contains('btn-reject-request')) { const requestId = btn.dataset.id; if(confirm(`Are you sure you want to reject request ${requestId}?`)) { postData('rejectItemRequest', { requestId }, btn).then(res => res && reloadDataAndRefreshUI()); } }
            if (btn.id === 'btn-print-pending-requests') {
                const tableToPrint = document.getElementById('table-pending-requests');
                if (tableToPrint) {
                    const printableDoc = `<div class="printable-document"><h2>Pending Approval Requests</h2><p>Date: ${new Date().toLocaleString()}</p>${tableToPrint.outerHTML}</div>`;
                    printContent(printableDoc);
                }
            }
            if (btn.classList.contains('btn-edit-po')) { openPOEditModal(btn.dataset.poId); }
            if (btn.classList.contains('btn-edit-invoice')) { openInvoiceEditModal(btn.dataset.batchId); }
            if (btn.classList.contains('btn-approve-financial') || btn.classList.contains('btn-reject-financial')) {
                const id = btn.dataset.id;
                const type = btn.dataset.type;
                const action = btn.classList.contains('btn-approve-financial') ? 'approveFinancial' : 'rejectFinancial';
                const confirmationText = action === 'approveFinancial' ? `Are you sure you want to approve this ${type.toUpperCase()}?` : `Are you sure you want to reject this ${type.toUpperCase()}? This action cannot be undone.`;
                
                if (confirm(confirmationText)) {
                    postData(action, { id, type }, btn).then(result => {
                        if (result) {
                            showToast(`${type.toUpperCase()} ${action.replace('Financial', '')}ed successfully!`, 'success');
                            reloadDataAndRefreshUI();
                        }
                    });
                }
            }
        });
        
        document.body.addEventListener('click', (e) => { 
            if (e.target.classList.contains('close-button') || e.target.classList.contains('modal-cancel')) { closeModal(); } 
            
            if (e.target.id === 'btn-confirm-receive-transfer') {
                const btn = e.target;
                const batchId = btn.dataset.batchId;
                const transferGroup = state.transactions.filter(t => t.batchId === batchId);
                const payload = { originalBatchId: batchId, ref: transferGroup[0].ref, fromBranchCode: transferGroup[0].fromBranchCode, toBranchCode: transferGroup[0].toBranchCode, items: transferGroup.map(t => ({ itemCode: t.itemCode, quantity: t.quantity })), notes: `Received from ${batchId}` };
                postData('receiveTransfer', payload, btn).then(result => {
                    if (result) { showToast('Transfer received!', 'success'); closeModal(); reloadDataAndRefreshUI(); }
                });
            }
            if (e.target.id === 'btn-reject-transfer') {
                const btn = e.target;
                const batchId = btn.dataset.batchId;
                if(confirm('Are you sure you want to reject this transfer? This action cannot be undone.')) {
                    postData('rejectTransfer', { batchId }, btn).then(result => {
                        if (result) { showToast('Transfer rejected.', 'success'); closeModal(); reloadDataAndRefreshUI(); }
                    });
                }
            }
            if (e.target.id === 'btn-confirm-request-approval') { confirmRequestApproval(e); }
            if (e.target.id === 'btn-save-po-changes') { savePOChanges(e); }
            if (e.target.id === 'btn-save-invoice-changes') { saveInvoiceChanges(e); }
        });
        document.getElementById('btn-confirm-modal-selection').addEventListener('click', confirmModalSelection);
        document.getElementById('btn-confirm-invoice-selection').addEventListener('click', confirmModalSelection);
        
        document.getElementById('payment-supplier-select').addEventListener('change', e => { document.getElementById('btn-select-invoices').disabled = !e.target.value; state.invoiceModalSelections.clear(); renderPaymentList(); });
        document.getElementById('table-payment-list').addEventListener('input', handlePaymentInputChange);
        document.getElementById('invoice-selector-modal').addEventListener('change', handleInvoiceModalCheckboxChange);
        modalItemList.addEventListener('change', handleModalCheckboxChange);
        modalSearchInput.addEventListener('input', e => renderItemsInModal(e.target.value));
        formEditRecord.addEventListener('submit', handleUpdateSubmit);
        document.getElementById('form-add-item').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const data = { code: document.getElementById('item-code').value, barcode: document.getElementById('item-barcode').value, name: document.getElementById('item-name').value, unit: document.getElementById('item-unit').value, category: document.getElementById('item-category').value, supplierCode: document.getElementById('item-supplier').value, cost: parseFloat(document.getElementById('item-cost').value) }; const result = await postData('addItem', data, btn); if (result) { showToast('Item added!', 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-add-supplier').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const data = { supplierCode: document.getElementById('supplier-code').value, name: document.getElementById('supplier-name').value, contact: document.getElementById('supplier-contact').value }; const result = await postData('addSupplier', data, btn); if (result) { showToast('Supplier added!', 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-add-branch').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const data = { branchCode: document.getElementById('branch-code').value, name: document.getElementById('branch-name').value }; const result = await postData('addBranch', data, btn); if (result) { showToast('Branch added!', 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-add-section').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const data = { sectionCode: document.getElementById('section-code').value, name: document.getElementById('section-name').value }; const result = await postData('addSection', data, btn); if (result) { showToast('Section added!', 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-record-payment').addEventListener('submit', async e => {
            e.preventDefault(); 
            const btn = e.target.querySelector('button[type="submit"]');
            const supplierCode = document.getElementById('payment-supplier-select').value;
            const method = document.getElementById('payment-method').value;
            if (!supplierCode || state.invoiceModalSelections.size === 0) {
                showToast('Please select a supplier and at least one invoice to pay.', 'error');
                return;
            }
            const paymentId = `PAY-${Date.now()}`;
            let totalAmount = 0;
            const payments = [];
            document.querySelectorAll('.payment-amount-input').forEach(input => {
                const amount = parseFloat(input.value) || 0;
                if (amount > 0) {
                    totalAmount += amount;
                    payments.push({
                        paymentId: paymentId,
                        date: new Date().toISOString(),
                        supplierCode: supplierCode,
                        invoiceNumber: input.dataset.invoice,
                        amount: amount,
                        method: method
                    });
                }
            });
            if (payments.length === 0) {
                showToast('Payment amount must be greater than zero.', 'error');
                return;
            }
            const payload = {
                supplierCode: supplierCode,
                method: method,
                date: new Date().toISOString(),
                totalAmount: totalAmount,
                payments: payments
            };
            const result = await postData('addPaymentBatch', payload, btn);
            if (result) {
                showToast('Payment recorded successfully!', 'success');
                generatePaymentVoucher(payload); 
                state.invoiceModalSelections.clear();
                document.getElementById('form-record-payment').reset();
                document.getElementById('btn-select-invoices').disabled = true;
                renderPaymentList();
                await reloadDataAndRefreshUI();
            }
        });
        
        document.getElementById('btn-submit-receive-batch').addEventListener('click', async (e) => { const btn = e.currentTarget; const supplierCode = document.getElementById('receive-supplier').value, branchCode = document.getElementById('receive-branch').value, invoiceNumber = document.getElementById('receive-invoice').value, notes = document.getElementById('receive-notes').value, poId = document.getElementById('receive-po-select').value; if (!userCan('opReceiveWithoutPO') && !poId) { showToast('You must select a Purchase Order to receive stock.', 'error'); return; } if (!supplierCode || !branchCode || !invoiceNumber || state.currentReceiveList.length === 0) { showToast('Please fill all required fields and add items.', 'error'); return; } const payload = { type: 'receive', batchId: `GRN-${Date.now()}`, supplierCode, branchCode, invoiceNumber, poId, date: new Date().toISOString(), items: state.currentReceiveList.map(i => ({...i, type: 'receive'})), notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-transfer-batch').addEventListener('click', async (e) => { const btn = e.currentTarget; const fromBranchCode = document.getElementById('transfer-from-branch').value, toBranchCode = document.getElementById('transfer-to-branch').value, notes = document.getElementById('transfer-notes').value, ref = document.getElementById('transfer-ref').value; if (!fromBranchCode || !toBranchCode || fromBranchCode === toBranchCode || state.currentTransferList.length === 0) { showToast('Please select valid branches and add at least one item.', 'error'); return; } const payload = { type: 'transfer_out', batchId: ref, ref: ref, fromBranchCode, toBranchCode, date: new Date().toISOString(), items: state.currentTransferList.map(i => ({...i, type: 'transfer_out'})), notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-issue-batch').addEventListener('click', async(e) => { const btn = e.currentTarget; const fromBranchCode = document.getElementById('issue-from-branch').value, sectionCode = document.getElementById('issue-to-section').value, ref = document.getElementById('issue-ref').value, notes = document.getElementById('issue-notes').value; if (!fromBranchCode || !sectionCode || !ref || state.currentIssueList.length === 0) { showToast('Please fill all issue details and select at least one item.', 'error'); return; } const payload = { type: 'issue', batchId: ref, ref: ref, fromBranchCode, sectionCode, date: new Date().toISOString(), items: state.currentIssueList.map(i => ({...i, type: 'issue'})), notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-po').addEventListener('click', async (e) => { const btn = e.currentTarget; const supplierCode = document.getElementById('po-supplier').value, poId = document.getElementById('po-ref').value, notes = document.getElementById('po-notes').value; if (!supplierCode || state.currentPOList.length === 0) { showToast('Please select a supplier and add items.', 'error'); return; } const totalValue = state.currentPOList.reduce((acc, item) => acc + (item.quantity * item.cost), 0); const payload = { type: 'po', poId, supplierCode, date: new Date().toISOString(), items: state.currentPOList, totalValue, notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-return').addEventListener('click', async (e) => { const btn = e.currentTarget; const supplierCode = document.getElementById('return-supplier').value, fromBranchCode = document.getElementById('return-branch').value, ref = document.getElementById('return-ref').value, notes = document.getElementById('return-notes').value; if (!supplierCode || !fromBranchCode || !ref || state.currentReturnList.length === 0) { showToast('Please fill all required fields and add items.', 'error'); return; } const payload = { type: 'return_out', batchId: `RTN-${Date.now()}`, ref: ref, supplierCode, fromBranchCode, date: new Date().toISOString(), items: state.currentReturnList.map(i => ({...i, type: 'return_out'})), notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-request').addEventListener('click', async(e) => { const btn = e.currentTarget; const requestType = document.getElementById('request-type').value; const notes = document.getElementById('request-notes').value; if(state.currentRequestList.length === 0){ showToast('Please select items for your request.', 'error'); return; } const payload = { requestId: `REQ-${Date.now()}`, requestType, notes, items: state.currentRequestList }; const result = await postData('addItemRequest', payload, btn); if(result){ showToast('Request submitted successfully!', 'success'); state.currentRequestList = []; document.getElementById('form-create-request').reset(); renderRequestListTable(); reloadDataAndRefreshUI(); }});
        
        const handleTableInputUpdate = (e, listName, updaterFn) => {
            if (e.target.classList.contains('table-input')) {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                if (state[listName] && state[listName][index]) {
                   if (!isNaN(value)) {
                       state[listName][index][field] = value;
                   }
                   if (updaterFn) updaterFn();
                }
            }
        };
        const handleTableRemove = (e, listName, rendererFn) => { 
            const btn = e.target.closest('button');
            if (btn && btn.classList.contains('danger') && btn.dataset.index) {
                state[listName].splice(btn.dataset.index, 1); 
                rendererFn(); 
            }
        };
        
        const setupInputTableListeners = (tableId, listName, rendererFn) => {
            const table = document.getElementById(tableId);
            if (!table) return;
            table.addEventListener('change', e => handleTableInputUpdate(e, listName, rendererFn));
            table.addEventListener('click', e => handleTableRemove(e, listName, rendererFn));
        };

        setupInputTableListeners('table-receive-list', 'currentReceiveList', renderReceiveListTable);
        setupInputTableListeners('table-po-list', 'currentPOList', renderPOListTable);
        setupInputTableListeners('table-edit-po-list', 'currentEditingPOList', renderPOEditListTable);
        setupInputTableListeners('table-return-list', 'currentReturnList', renderReturnListTable);
        setupInputTableListeners('table-transfer-list', 'currentTransferList', renderTransferListTable);
        setupInputTableListeners('table-issue-list', 'currentIssueList', renderIssueListTable);
        setupInputTableListeners('table-request-list', 'currentRequestList', renderRequestListTable);
        setupInputTableListeners('table-adjustment-list', 'currentAdjustmentList', renderAdjustmentListTable);
        
        document.getElementById('btn-submit-adjustment').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const branchCode = document.getElementById('adjustment-branch').value;
            const ref = document.getElementById('adjustment-ref').value;
            const notes = document.getElementById('adjustment-notes').value;
            if (!branchCode || !ref || !state.currentAdjustmentList || state.currentAdjustmentList.length === 0) {
                showToast('Please select a branch, provide a reference, and add items to adjust.', 'error');
                return;
            }

            const stock = calculateStockLevels();
            const adjustmentItems = state.currentAdjustmentList.map(item => {
                const systemQty = (stock[branchCode]?.[item.itemCode]?.quantity) || 0;
                const physicalCount = item.physicalCount || 0;
                const adjustmentQty = physicalCount - systemQty;
                
                if (Math.abs(adjustmentQty) < 0.01) return null;

                return {
                    itemCode: item.itemCode,
                    quantity: Math.abs(adjustmentQty),
                    type: adjustmentQty > 0 ? 'adjustment_in' : 'adjustment_out',
                    cost: findByKey(state.items, 'code', item.itemCode)?.cost || 0
                };
            }).filter(Boolean);

            if (adjustmentItems.length === 0) {
                showToast('No adjustments needed for the entered counts.', 'info');
                return;
            }

            const payload = {
                type: 'stock_adjustment',
                batchId: `ADJ-${Date.now()}`,
                ref: ref,
                fromBranchCode: branchCode,
                notes: notes,
                items: adjustmentItems
            };
            await handleTransactionSubmit(payload, btn);
            state.currentAdjustmentList = [];
            renderAdjustmentListTable();
            document.getElementById('form-adjustment-details').reset();
        });

        document.getElementById('form-financial-adjustment').addEventListener('submit', async(e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const supplierCode = document.getElementById('fin-adj-supplier').value;
            const balance = parseFloat(document.getElementById('fin-adj-balance').value);
            
            if (!supplierCode || isNaN(balance) || balance < 0) {
                showToast('Please select a supplier and enter a valid opening balance.', 'error');
                return;
            }
            
            if (!confirm(`Are you sure you want to set the opening balance for this supplier to ${balance.toFixed(2)} EGP? This should only be done once.`)) {
                return;
            }

            const payload = {
                supplierCode: supplierCode,
                balance: balance,
                ref: `OB-${supplierCode}`
            };
            
            const result = await postData('financialAdjustment', payload, btn);
            if (result) {
                showToast('Supplier opening balance set successfully!', 'success');
                e.target.reset();
                await reloadDataAndRefreshUI();
            }
        });
        
        document.getElementById('btn-generate-supplier-statement').addEventListener('click', () => { const supplierCode = document.getElementById('supplier-statement-select').value; const startDate = document.getElementById('statement-start-date').value; const endDate = document.getElementById('statement-end-date').value; if(!supplierCode) { showToast('Please select a supplier.', 'error'); return; } renderSupplierStatement(supplierCode, startDate, endDate); });
        document.getElementById('btn-generate-branch-consumption').addEventListener('click', () => { const branchCode = document.getElementById('branch-consumption-select').value; const startDate = document.getElementById('branch-consumption-start-date').value; const endDate = document.getElementById('branch-consumption-end-date').value; const itemFilter = document.getElementById('branch-consumption-item-filter').value; const categoryFilter = document.getElementById('branch-consumption-category-filter').value; if(!branchCode) { showToast('Please select a branch.', 'error'); return; } let filteredTx = state.transactions.filter(t => t.type === 'issue' && t.fromBranchCode === branchCode); const sDate = startDate ? new Date(startDate) : null; if(sDate) sDate.setHours(0,0,0,0); const eDate = endDate ? new Date(endDate) : null; if(eDate) eDate.setHours(23,59,59,999); if (sDate) filteredTx = filteredTx.filter(t => new Date(t.date) >= sDate); if (eDate) filteredTx = filteredTx.filter(t => new Date(t.date) <= eDate); if (itemFilter) filteredTx = filteredTx.filter(t => t.itemCode === itemFilter); if (categoryFilter) { const itemCodesInCategory = state.items.filter(i => i.category === categoryFilter).map(i => i.code); filteredTx = filteredTx.filter(t => itemCodesInCategory.includes(t.itemCode)); } const historicalCosts = calculateHistoricalCosts(); renderConsumptionReport({ resultsContainerId: 'branch-consumption-results', exportBtnId: 'btn-export-branch-consumption', data: filteredTx, title: 'Branch Consumption Report', entityName: findByKey(state.branches, 'branchCode', branchCode).name, dateHeader: `${startDate || 'Start'} to ${endDate || 'End'}`, historicalCosts: historicalCosts }); });
        document.getElementById('btn-generate-section-consumption').addEventListener('click', () => { const sectionCode = document.getElementById('section-consumption-select').value; const startDate = document.getElementById('section-consumption-start-date').value; const endDate = document.getElementById('section-consumption-end-date').value; const itemFilter = document.getElementById('section-consumption-item-filter').value; const categoryFilter = document.getElementById('section-consumption-category-filter').value; if(!sectionCode) { showToast('Please select a section.', 'error'); return; } let filteredTx = state.transactions.filter(t => t.type === 'issue' && t.sectionCode === sectionCode); const sDate = startDate ? new Date(startDate) : null; if(sDate) sDate.setHours(0,0,0,0); const eDate = endDate ? new Date(endDate) : null; if(eDate) eDate.setHours(23,59,59,999); if (sDate) filteredTx = filteredTx.filter(t => new Date(t.date) >= sDate); if (eDate) filteredTx = filteredTx.filter(t => new Date(t.date) <= eDate); if (itemFilter) filteredTx = filteredTx.filter(t => t.itemCode === itemFilter); if (categoryFilter) { const itemCodesInCategory = state.items.filter(i => i.category === categoryFilter).map(i => i.code); filteredTx = filteredTx.filter(t => itemCodesInCategory.includes(t.itemCode)); } const historicalCosts = calculateHistoricalCosts(); renderConsumptionReport({ resultsContainerId: 'section-consumption-results', exportBtnId: 'btn-export-section-consumption', data: filteredTx, title: 'Section Consumption Report', entityName: findByKey(state.sections, 'sectionCode', sectionCode).name, dateHeader: `${startDate || 'Start'} to ${endDate || 'End'}`, historicalCosts: historicalCosts }); });
        document.getElementById('btn-generate-resupply-report').addEventListener('click', () => { const branchCode = document.getElementById('resupply-branch-filter').value; const startDate = document.getElementById('resupply-start-date').value; const endDate = document.getElementById('resupply-end-date').value; let filteredReqs = state.itemRequests.filter(r => r.Type === 'resupply'); const sDate = startDate ? new Date(startDate) : null; if(sDate) sDate.setHours(0,0,0,0); const eDate = endDate ? new Date(endDate) : null; if(eDate) eDate.setHours(23,59,59,999); if (branchCode) filteredReqs = filteredReqs.filter(r => r.ToBranch === branchCode); if (sDate) filteredReqs = filteredReqs.filter(r => new Date(r.Date) >= sDate); if (eDate) filteredReqs = filteredReqs.filter(r => new Date(r.Date) <= eDate); const entityName = branchCode ? findByKey(state.branches, 'branchCode', branchCode).name : 'All Branches'; renderConsumptionReport({ resultsContainerId: 'resupply-report-results', exportBtnId: 'btn-export-resupply-report', data: filteredReqs.map(r => ({...r, fromBranchCode: r.ToBranch, itemCode: r.ItemCode, quantity: r.Quantity})), title: 'Resupply Request Report', entityName: entityName, dateHeader: `${startDate || 'Start'} to ${endDate || 'End'}`, qtyColumnHeader: 'Total Qty Requested' }); });
        
        document.getElementById('pending-requests-widget').addEventListener('click', () => showView('requests', 'pending-approval'));

        ['tx-filter-start-date', 'tx-filter-end-date', 'tx-filter-type', 'tx-filter-branch', 'transaction-search'].forEach(id => {
            const el = document.getElementById(id);
            const eventType = (el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'input';
            el.addEventListener(eventType, () => {
                const filters = {
                    startDate: document.getElementById('tx-filter-start-date').value,
                    endDate: document.getElementById('tx-filter-end-date').value,
                    type: document.getElementById('tx-filter-type').value,
                    branch: document.getElementById('tx-filter-branch').value,
                    searchTerm: document.getElementById('transaction-search').value,
                };
                renderTransactionHistory(filters);
            });
        });

        document.getElementById('receive-po-select').addEventListener('change', e => {
            const poId = e.target.value;
            if(!poId) {
                state.currentReceiveList = [];
                renderReceiveListTable();
                document.getElementById('receive-supplier').value = '';
                return;
            }
            const po = findByKey(state.purchaseOrders, 'poId', poId);
            const poItems = state.purchaseOrderItems.filter(i => i.poId === poId);
            document.getElementById('receive-supplier').value = po.supplierCode;
            state.currentReceiveList = poItems.map(item => {
                const masterItem = findByKey(state.items, 'code', item.itemCode);
                return { itemCode: item.itemCode, itemName: masterItem?.name || 'Unknown Item', quantity: parseFloat(item.quantity), cost: parseFloat(item.cost) }
            });
            renderReceiveListTable();
        });
    }
    
    function setupRoleBasedNav() {
        const user = state.currentUser; if (!user) return;
        const userFirstName = user.Name.split(' ')[0];
        document.querySelector('.sidebar-header h1').textContent = `Hi, ${userFirstName}`;
        const navMap = { 'dashboard': 'viewDashboard', 'operations': 'viewOperations', 'purchasing': 'viewPurchasing', 'requests': 'viewRequests', 'payments': 'viewPayments', 'reports': 'viewReports', 'stock-levels': 'viewStockLevels', 'transaction-history': 'viewTransactionHistory', 'setup': 'viewSetup', 'master-data': 'viewMasterData', 'user-management': 'manageUsers', 'backup': 'opBackupRestore', 'activity-log': 'viewActivityLog' };
        for (const [view, permission] of Object.entries(navMap)) {
            const navItem = document.querySelector(`[data-view="${view}"]`);
            if (navItem) { 
                let hasPermission = userCan(permission);
                if (view === 'requests') { hasPermission = userCan('opRequestItems') || userCan('opApproveIssueRequest') || userCan('opApproveResupplyRequest'); }
                if (view === 'operations') { hasPermission = userCan('viewOperations') || userCan('opStockAdjustment') || userCan('opFinancialAdjustment'); }
                navItem.parentElement.style.display = hasPermission ? '' : 'none'; 
            }
        }
    }
    
    function logout() { Logger.info('User logging out.'); location.reload(); }
    
    function initializeAppUI() {
        Logger.info('Application UI initializing...');
        setupRoleBasedNav();
        attachEventListeners();
        attachSubNavListeners();
        setupSearch('search-items', renderItemsTable, 'items', ['name', 'code', 'category']);
        setupSearch('search-suppliers', renderSuppliersTable, 'suppliers', ['name', 'supplierCode']);
        setupSearch('search-branches', renderBranchesTable, 'branches', ['name', 'branchCode']);
        setupSearch('search-sections', renderSectionsTable, 'sections', ['name', 'sectionCode']);
        setupSearch('stock-levels-search', renderItemCentricStockView, 'items', ['name', 'code']);
        document.getElementById('item-inquiry-search').addEventListener('input', e => renderItemInquiry(e.target.value.toLowerCase()));
        
        document.getElementById('btn-export-items').addEventListener('click', () => exportToExcel('table-items', 'ItemList.xlsx'));
        document.getElementById('btn-export-suppliers').addEventListener('click', () => exportToExcel('table-suppliers', 'SupplierList.xlsx'));
        document.getElementById('btn-export-branches').addEventListener('click', () => exportToExcel('table-branches', 'BranchList.xlsx'));
        document.getElementById('btn-export-sections').addEventListener('click', () => exportToExcel('table-sections', 'SectionList.xlsx'));
        document.getElementById('btn-export-stock').addEventListener('click', () => exportToExcel('table-stock-levels-by-item', 'StockLevels.xlsx'));
        document.getElementById('btn-export-supplier-statement').addEventListener('click', () => exportToExcel('table-supplier-statement-report', 'SupplierStatement.xlsx'));
        document.getElementById('btn-export-branch-consumption').addEventListener('click', () => exportToExcel('table-branch-consumption-results-report', 'BranchConsumption.xlsx'));
        document.getElementById('btn-export-section-consumption').addEventListener('click', () => exportToExcel('table-section-consumption-results-report', 'SectionConsumption.xlsx'));
        document.getElementById('btn-export-resupply-report').addEventListener('click', () => exportToExcel('table-resupply-report-results-report', 'ResupplyReport.xlsx'));
        
        updateUserBranchDisplay();
        updatePendingRequestsWidget();
        const firstVisibleView = document.querySelector('#main-nav .nav-item:not([style*="display: none"]) a')?.dataset.view || 'dashboard';
        showView(firstVisibleView);
        Logger.info('Application initialized successfully.');
    }
    
    function updateUserBranchDisplay() {
        const displayEl = document.getElementById('user-branch-display');
        if (!state.currentUser) { displayEl.textContent = ''; return; }
        const branch = findByKey(state.branches, 'branchCode', state.currentUser.AssignedBranchCode);
        const section = findByKey(state.sections, 'sectionCode', state.currentUser.AssignedSectionCode);
        let displayText = '';
        if (branch) displayText += `Branch: ${branch.name}`;
        if (section) displayText += `${displayText ? ' / ' : ''}Section: ${section.name}`;
        displayEl.textContent = displayText;
    }

    function openPOEditModal(poId) {
        const po = findByKey(state.purchaseOrders, 'poId', poId);
        if (!po) return;
        const poItems = state.purchaseOrderItems.filter(i => i.poId === poId);
        state.currentEditingPOList = poItems.map(item => {
            const masterItem = findByKey(state.items, 'code', item.itemCode);
            return {
                itemCode: item.itemCode,
                itemName: masterItem?.name || "N/A",
                quantity: parseFloat(item.quantity),
                cost: parseFloat(item.cost)
            };
        });

        const modalBody = document.getElementById('edit-po-modal-body');
        modalBody.innerHTML = `
            <div class="form-grid">
                <div class="form-group"><label>PO Number</label><input type="text" id="edit-po-id" value="${po.poId}" readonly></div>
                <div class="form-group"><label>Supplier</label><input type="text" value="${findByKey(state.suppliers, 'supplierCode', po.supplierCode)?.name}" readonly></div>
                <div class="form-group span-full"><label for="edit-po-notes">Notes</label><textarea id="edit-po-notes" rows="2">${po.notes || ''}</textarea></div>
            </div>
            <div class="card" style="margin-top: 20px;">
                <h2>Items to Order</h2>
                <table id="table-edit-po-list">
                    <thead><tr><th>Code</th><th>Item Name</th><th>Quantity</th><th>Cost/Unit</th><th>Total</th><th>Action</th></tr></thead>
                    <tbody></tbody>
                    <tfoot><tr style="font-weight: bold; background-color: var(--bg-color);"><td colspan="4" style="text-align: right;">Grand Total:</td><td id="edit-po-grand-total" colspan="2">0.00 EGP</td></tr></tfoot>
                </table>
                <div style="margin-top: 20px;"><button type="button" data-context="edit-po" class="secondary">Add More Items</button></div>
            </div>
        `;
        
        const modal = document.getElementById('edit-po-modal');
        modal.querySelector('.modal-footer').innerHTML = `
            <button class="secondary modal-cancel">Cancel</button>
            <button id="btn-print-draft-po" class="secondary">Print Draft</button>
            <button id="btn-save-po-changes" class="primary" data-po-id="${po.poId}">Save Changes</button>
        `;
        
        document.getElementById('btn-print-draft-po').onclick = () => {
            const supplier = findByKey(state.suppliers, 'supplierCode', po.supplierCode);
            const dataToPrint = {
                poId: document.getElementById('edit-po-id').value,
                date: new Date(),
                supplierCode: po.supplierCode,
                notes: document.getElementById('edit-po-notes').value,
                items: state.currentEditingPOList,
                createdBy: po.createdBy || state.currentUser.Name
            };
            generatePODocument(dataToPrint);
        };

        renderPOEditListTable();
        editPOModal.classList.add('active');
    }

    // --- NEW FUNCTION TO FIX EDIT INVOICE BUTTON ---
    function openInvoiceEditModal(batchId) {
        const txGroup = state.transactions.filter(t => t.batchId === batchId && t.type === 'receive');
        if (txGroup.length === 0) {
            showToast('Could not find invoice data to edit.', 'error');
            return;
        }
        const firstTx = txGroup[0];

        // Reuse the PO editing list and renderer for consistency
        state.currentEditingPOList = txGroup.map(tx => {
            const masterItem = findByKey(state.items, 'code', tx.itemCode);
            return {
                itemCode: tx.itemCode,
                itemName: masterItem?.name || 'N/A',
                quantity: parseFloat(tx.quantity),
                cost: parseFloat(tx.cost)
            };
        });

        const modalBody = document.getElementById('edit-po-modal-body');
        const supplier = findByKey(state.suppliers, 'supplierCode', firstTx.supplierCode);
        const branch = findByKey(state.branches, 'branchCode', firstTx.branchCode);

        modalBody.innerHTML = `
            <div class="form-grid">
                <div class="form-group"><label>Batch ID</label><input type="text" value="${batchId}" readonly></div>
                <div class="form-group"><label>Supplier</label><input type="text" value="${supplier?.name || 'N/A'}" readonly></div>
                <div class="form-group"><label>Branch</label><input type="text" value="${branch?.name || 'N/A'}" readonly></div>
                <div class="form-group"><label for="edit-invoice-number">Invoice Number</label><input type="text" id="edit-invoice-number" value="${firstTx.invoiceNumber || ''}" required></div>
                <div class="form-group span-full"><label for="edit-invoice-notes">Notes</label><textarea id="edit-invoice-notes" rows="2">${firstTx.notes || ''}</textarea></div>
            </div>
            <div class="card" style="margin-top: 20px;">
                <h2>Items Received</h2>
                <table id="table-edit-po-list">
                    <thead><tr><th>Code</th><th>Item Name</th><th>Quantity</th><th>Cost/Unit</th><th>Total</th><th>Action</th></tr></thead>
                    <tbody></tbody>
                    <tfoot><tr style="font-weight: bold; background-color: var(--bg-color);"><td colspan="4" style="text-align: right;">Grand Total:</td><td id="edit-po-grand-total" colspan="2">0.00 EGP</td></tr></tfoot>
                </table>
                <div style="margin-top: 20px;"><button type="button" data-context="edit-po" class="secondary">Add/Edit Items</button></div>
            </div>
        `;

        const modal = document.getElementById('edit-po-modal');
        document.getElementById('edit-po-modal-title').textContent = 'Edit Invoice / GRN';
        modal.querySelector('.modal-footer').innerHTML = `
            <button type="button" class="secondary modal-cancel">Cancel</button>
            <button id="btn-save-invoice-changes" class="primary" data-batch-id="${batchId}">Save Changes</button>
        `;

        renderPOEditListTable();
        editPOModal.classList.add('active');
    }
    
    async function savePOChanges(e) {
        const btn = e.currentTarget;
        const poId = btn.dataset.poId;
        const notes = document.getElementById('edit-po-notes').value;
        const totalValue = state.currentEditingPOList.reduce((acc, item) => acc + (item.quantity * item.cost), 0);
        const payload = {
            poId,
            notes,
            totalValue,
            items: state.currentEditingPOList
        };
        const result = await postData('editPurchaseOrder', payload, btn);
        if (result) {
            showToast('PO updated successfully!', 'success');
            closeModal();
            reloadDataAndRefreshUI();
        }
    }

    // --- NEW FUNCTION TO SAVE INVOICE CHANGES ---
    async function saveInvoiceChanges(e) {
        const btn = e.currentTarget;
        const batchId = btn.dataset.batchId;
        const notes = document.getElementById('edit-invoice-notes').value;
        const invoiceNumber = document.getElementById('edit-invoice-number').value;

        if (!invoiceNumber) {
            showToast('Invoice Number is required.', 'error');
            return;
        }

        const payload = {
            batchId,
            invoiceNumber,
            notes,
            items: state.currentEditingPOList
        };
        const result = await postData('editInvoice', payload, btn);
        if (result) {
            showToast('Invoice updated successfully!', 'success');
            closeModal();
            reloadDataAndRefreshUI();
        }
    }

    function openApproveRequestModal(requestId) {
        const requestGroup = state.itemRequests.filter(r => r.RequestID === requestId);
        if (requestGroup.length === 0) return;
        const first = requestGroup[0];
        const stock = calculateStockLevels();
        const branchStock = stock[first.ToBranch] || {};
        
        document.getElementById('approve-request-modal-title').textContent = `Approve Request: ${requestId}`;
        const modalBody = document.getElementById('approve-request-modal-body');

        let itemsHtml = '';
        requestGroup.forEach(req => {
            const item = findByKey(state.items, 'code', req.ItemCode);
            const availableQty = branchStock[req.ItemCode]?.quantity || 0;
            itemsHtml += `
                <tr>
                    <td>${req.ItemCode}</td>
                    <td>${item?.name || 'N/A'}</td>
                    <td>${req.Quantity}</td>
                    <td>${availableQty.toFixed(2)}</td>
                    <td><input type="number" class="table-input" data-item-code="${req.ItemCode}" value="${req.Quantity}" min="0" max="${availableQty}" step="0.01"></td>
                </tr>
            `;
        });

        modalBody.innerHTML = `
            <p><strong>From Section:</strong> ${findByKey(state.sections, 'sectionCode', first.FromSection)?.name}</p>
            <p><strong>To Branch:</strong> ${findByKey(state.branches, 'branchCode', first.ToBranch)?.name}</p>
            <p><strong>Notes:</strong> ${first.Notes || 'N/A'}</p>
            <hr>
            <table id="table-approve-request-items">
                <thead><tr><th>Code</th><th>Item</th><th>Qty Req.</th><th>Available</th><th>Qty to Issue</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="form-group" style="margin-top: 20px;">
                <label for="approve-status-notes">Notes (Optional)</label>
                <textarea id="approve-status-notes" rows="2" placeholder="e.g., Partial issue due to stock availability."></textarea>
            </div>
        `;
        
        const modal = document.getElementById('approve-request-modal');
        const confirmBtn = modal.querySelector('#btn-confirm-request-approval');
        confirmBtn.dataset.requestId = requestId;
        
        document.getElementById('btn-print-draft-issue-note').onclick = () => {
            const itemsToPrint = [];
            document.querySelectorAll('#table-approve-request-items tbody tr').forEach(tr => {
                const input = tr.querySelector('input');
                const itemCode = input.dataset.itemCode;
                const quantity = parseFloat(input.value) || 0;
                if (quantity > 0) {
                    itemsToPrint.push({
                        itemCode: itemCode,
                        itemName: findByKey(state.items, 'code', itemCode)?.name,
                        quantity: quantity
                    });
                }
            });
            const dataToPrint = {
                ref: requestId,
                date: new Date(),
                fromBranchCode: first.ToBranch,
                sectionCode: first.FromSection,
                notes: document.getElementById('approve-status-notes').value,
                items: itemsToPrint
            };
            generateRequestIssueDocument(dataToPrint);
        };
        
        approveRequestModal.classList.add('active');
    }
    
    async function confirmRequestApproval(e) {
        const btn = e.currentTarget;
        const requestId = btn.dataset.requestId;
        if (!requestId) {
            showToast('Error: Request ID is missing.', 'error');
            return;
        }
        const statusNotes = document.getElementById('approve-status-notes').value;
        const editedItems = [];
        document.querySelectorAll('#table-approve-request-items tbody tr').forEach(tr => {
            const input = tr.querySelector('input');
            editedItems.push({
                itemCode: input.dataset.itemCode,
                issuedQuantity: parseFloat(input.value) || 0
            });
        });
        
        const payload = { requestId, statusNotes, editedItems };
        const result = await postData('approveItemRequest', payload, btn);
        if (result) {
            showToast('Request approved and processed!', 'success');
            closeModal();
            reloadDataAndRefreshUI();
        }
    }

    function init() {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = loginUsernameInput.value.trim();
            const code = loginCodeInput.value;
            if (username && code) {
                attemptLogin(username, code);
            }
        });
    }

    init();
});
