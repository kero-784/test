// PART 1 OF 4: CORE SETUP & API

// Generic print function for reports, globally accessible
window.printReport = function(elementId) {
    const reportContent = document.querySelector(`#${elementId} .printable-document`);
    if (reportContent) {
        document.getElementById('print-area').innerHTML = reportContent.outerHTML;
        setTimeout(() => window.print(), 100);
    } else {
        console.error(`Could not find content to print in #${elementId}`);
        alert("Error: Report content not found. Please regenerate the report.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // !!! IMPORTANT: PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwUbo8QQ2_LEZQAV0Wx5Q903SlLUjOr6jyju20GC0kX-KfdI4g70ZYSBPKfvvJYm8qw/exec';

    const Logger = {
        info: (message, ...args) => console.log(`[StockWise INFO] ${message}`, ...args),
        warn: (message, ...args) => console.warn(`[StockWise WARN] ${message}`, ...args),
        error: (message, ...args) => console.error(`[StockWise ERROR] ${message}`, ...args),
    };

    let state = {
        items: [], suppliers: [], branches: [], sections: [], transactions: [], payments: [], activityLog: [],
        isLoading: true,
        currentReceiveList: [], currentTransferList: [], currentIssueList: [],
        modalSelections: new Set(), invoiceModalSelections: new Set()
    };
    let modalContext = null;

    // --- DOM ELEMENT REFERENCES ---
    const itemSelectorModal = document.getElementById('item-selector-modal');
    const invoiceSelectorModal = document.getElementById('invoice-selector-modal');
    const editModal = document.getElementById('edit-modal');
    const modalItemList = document.getElementById('modal-item-list');
    const modalSearchInput = document.getElementById('modal-search-items');
    const editModalBody = document.getElementById('edit-modal-body');
    const editModalTitle = document.getElementById('edit-modal-title');
    const formEditRecord = document.getElementById('form-edit-record');

    async function loadData() {
        Logger.info('Attempting to load data...');
        if (!SCRIPT_URL || !SCRIPT_URL.includes('macros/s')) {
            const errorMsg = 'SCRIPT_URL is not set or invalid in script.js. Please paste your Google Apps Script URL.';
            Logger.error(errorMsg);
            document.getElementById('app-loader').innerHTML = `<p style="color:var(--danger-color);font-weight:bold;">${errorMsg}</p>`;
            return;
        }
        try {
            const response = await fetch(SCRIPT_URL);
            if (!response.ok) throw new Error(`Network error: ${response.status} ${response.statusText}`);
            const data = await response.json();
            state.items = data.items || [];
            state.suppliers = data.suppliers || [];
            state.branches = data.branches || [];
            state.sections = data.sections || [];
            state.transactions = data.transactions || [];
            state.payments = data.payments || [];
            state.activityLog = data.activityLog || [];
            state.isLoading = false;
            Logger.info('Data loaded successfully.');
        } catch (error) {
            const userMsg = 'Failed to load data. See console for details.';
            Logger.error(userMsg, error);
            document.getElementById('app-loader').innerHTML = `<p style="color:var(--danger-color);font-weight:bold;">${userMsg}</p>`;
        }
    }

    async function postData(action, data, buttonEl) {
        setButtonLoading(true, buttonEl);
        Logger.info(`POSTing data: ${action}`, data);
        try {
            const response = await fetch(SCRIPT_URL, { method: 'POST', mode: 'cors', body: JSON.stringify({ action, data }) });
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'An unknown error occurred on the server.');
            Logger.info(`POST successful for ${action}`, result);
            return result;
        } catch (error) {
            const userMsg = 'Could not save data. See console for details.';
            Logger.error(userMsg, error);
            showToast(userMsg, 'error');
            return null;
        } finally {
            setButtonLoading(false, buttonEl);
        }
    }
    // PART 2 OF 4: MODAL & UI LOGIC

    function openItemSelectorModal() {
        let currentList;
        if(document.getElementById('view-receive').classList.contains('active')) {
            modalContext = 'receive';
            currentList = state.currentReceiveList;
        } else if (document.getElementById('view-transfer').classList.contains('active')) {
            modalContext = 'transfer';
            currentList = state.currentTransferList;
        } else if (document.getElementById('view-issue').classList.contains('active')) {
            modalContext = 'issue';
            currentList = state.currentIssueList;
        }
        state.modalSelections = new Set(currentList.map(item => item.itemCode));
        renderItemsInModal();
        itemSelectorModal.classList.add('active');
    }

    function openInvoiceSelectorModal() {
        modalContext = 'invoices';
        renderInvoicesInModal();
        invoiceSelectorModal.classList.add('active');
    }

    function closeModal() {
        itemSelectorModal.classList.remove('active');
        invoiceSelectorModal.classList.remove('active');
        editModal.classList.remove('active');
        modalSearchInput.value = '';
        modalContext = null;
    }

    function openEditModal(type, id) {
        let record, formHtml;
        formEditRecord.dataset.type = type;
        formEditRecord.dataset.id = id;
        switch (type) {
            case 'item':
                record = findByKey(state.items, 'code', id); if (!record) return; editModalTitle.textContent = 'Edit Item';
                formHtml = `<div class="form-grid"><div class="form-group"><label>Item Code</label><input type="text" value="${record.code}" readonly></div><div class="form-group"><label for="edit-item-barcode">Barcode</label><input type="text" id="edit-item-barcode" name="barcode" value="${record.barcode || ''}"></div><div class="form-group"><label for="edit-item-name">Item Name</label><input type="text" id="edit-item-name" name="name" value="${record.name}" required></div><div class="form-group"><label for="edit-item-unit">Unit</label><input type="text" id="edit-item-unit" name="unit" value="${record.unit}" required></div><div class="form-group"><label for="edit-item-supplier">Default Supplier</label><select id="edit-item-supplier" name="supplierCode"></select></div><div class="form-group"><label for="edit-item-cost">Default Cost</label><input type="number" id="edit-item-cost" name="cost" step="0.01" min="0" value="${record.cost}" required></div></div>`;
                editModalBody.innerHTML = formHtml;
                const supplierSelect = document.getElementById('edit-item-supplier');
                populateOptions(supplierSelect, state.suppliers, 'Select Supplier', 'supplierCode', 'name');
                supplierSelect.value = record.supplierCode;
                break;
            case 'supplier':
                record = findByKey(state.suppliers, 'supplierCode', id); if (!record) return; editModalTitle.textContent = 'Edit Supplier';
                formHtml = `<div class="form-grid"><div class="form-group"><label>Supplier Code</label><input type="text" value="${record.supplierCode}" readonly></div><div class="form-group"><label for="edit-supplier-name">Supplier Name</label><input type="text" id="edit-supplier-name" name="name" value="${record.name}" required></div><div class="form-group"><label for="edit-supplier-contact">Contact Info</label><input type="text" id="edit-supplier-contact" name="contact" value="${record.contact || ''}"></div></div>`;
                editModalBody.innerHTML = formHtml;
                break;
            case 'branch':
                record = findByKey(state.branches, 'branchCode', id); if (!record) return; editModalTitle.textContent = 'Edit Branch';
                formHtml = `<div class="form-grid"><div class="form-group"><label>Branch Code</label><input type="text" value="${record.branchCode}" readonly></div><div class="form-group"><label for="edit-branch-name">Branch Name</label><input type="text" id="edit-branch-name" name="name" value="${record.name}" required></div></div>`;
                editModalBody.innerHTML = formHtml;
                break;
            case 'section':
                record = findByKey(state.sections, 'sectionCode', id); if (!record) return; editModalTitle.textContent = 'Edit Section';
                formHtml = `<div class="form-grid"><div class="form-group"><label>Section Code</label><input type="text" value="${record.sectionCode}" readonly></div><div class="form-group"><label for="edit-section-name">Section Name</label><input type="text" id="edit-section-name" name="name" value="${record.name}" required></div></div>`;
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
        const updates = {};
        for (let [key, value] of formData.entries()) {
            updates[key] = value;
        }
        const result = await postData('updateData', { type, id, updates }, btn);
        if (result) {
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully!`, 'success');
            closeModal();
            await reloadDataAndRefreshUI();
        }
    }

    function renderItemsInModal(filter = '') {
        modalItemList.innerHTML = ''; const lowercasedFilter = filter.toLowerCase();
        state.items.filter(item => item.name.toLowerCase().includes(lowercasedFilter) || item.code.toLowerCase().includes(lowercasedFilter))
            .forEach(item => {
                const isChecked = state.modalSelections.has(item.code);
                const itemDiv = document.createElement('div');
                itemDiv.className = 'modal-item';
                itemDiv.innerHTML = `<input type="checkbox" id="modal-item-${item.code}" data-code="${item.code}" ${isChecked ? 'checked' : ''}><label for="modal-item-${item.code}"><strong>${item.name}</strong><br><small style="color:var(--text-light-color)">Code: ${item.code} | Barcode: ${item.barcode || 'N/A'}</small></label>`;
                modalItemList.appendChild(itemDiv);
            });
    }

    function renderInvoicesInModal() {
        const modalInvoiceList = document.getElementById('modal-invoice-list');
        const supplierCode = document.getElementById('payment-supplier-select').value;
        const supplierFinancials = calculateSupplierFinancials();
        const supplierInvoices = supplierFinancials[supplierCode]?.invoices;
        modalInvoiceList.innerHTML = '';
        if (!supplierInvoices || Object.keys(supplierInvoices).length === 0) { modalInvoiceList.innerHTML = '<p>No invoices found for this supplier.</p>'; return; }
        const unpaidInvoices = Object.values(supplierInvoices).filter(inv => inv.status !== 'Paid');
        if (unpaidInvoices.length === 0) { modalInvoiceList.innerHTML = '<p>No unpaid invoices for this supplier.</p>'; return; }
        unpaidInvoices.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(invoice => {
            const isChecked = state.invoiceModalSelections.has(invoice.number);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'modal-item';
            itemDiv.innerHTML = `<input type="checkbox" id="modal-invoice-${invoice.number}" data-number="${invoice.number}" ${isChecked ? 'checked' : ''}><label for="modal-invoice-${invoice.number}"><strong>Invoice #: ${invoice.number}</strong><br><small style="color:var(--text-light-color)">Date: ${new Date(invoice.date).toLocaleDateString()} | Amount Due: ${invoice.balance.toFixed(2)} EGP</small></label>`;
            modalInvoiceList.appendChild(itemDiv);
        });
    }

    function handleModalCheckboxChange(e) { if (e.target.type === 'checkbox') { const itemCode = e.target.dataset.code; if (e.target.checked) { state.modalSelections.add(itemCode); } else { state.modalSelections.delete(itemCode); } } }
    function handleInvoiceModalCheckboxChange(e) { if (e.target.type === 'checkbox') { const invoiceNumber = e.target.dataset.number; if (e.target.checked) { state.invoiceModalSelections.add(invoiceNumber); } else { state.invoiceModalSelections.delete(invoiceNumber); } } }

    function renderPaymentList() {
        const supplierCode = document.getElementById('payment-supplier-select').value;
        const container = document.getElementById('payment-invoice-list-container');
        if (!supplierCode) { container.style.display = 'none'; return; } // Hide if no supplier
        const supplierInvoices = calculateSupplierFinancials()[supplierCode]?.invoices;
        const tableBody = document.getElementById('table-payment-list').querySelector('tbody');
        tableBody.innerHTML = ''; let total = 0;
        if (state.invoiceModalSelections.size === 0) { container.style.display = 'none'; return; }
        state.invoiceModalSelections.forEach(invNum => {
            const invoice = supplierInvoices[invNum];
            if (!invoice) return;
            const balance = invoice.balance; total += balance;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${invoice.number}</td><td>${balance.toFixed(2)} EGP</td><td><input type="number" class="table-input payment-amount-input" data-invoice="${invoice.number}" value="${balance.toFixed(2)}" step="0.01" min="0" max="${balance.toFixed(2)}" style="max-width: 150px;"></td>`;
            tableBody.appendChild(tr);
        });
        document.getElementById('payment-total-amount').textContent = `${total.toFixed(2)} EGP`;
        container.style.display = 'block';
    }

    function handlePaymentInputChange() { let total = 0; document.querySelectorAll('.payment-amount-input').forEach(input => { total += parseFloat(input.value) || 0; }); document.getElementById('payment-total-amount').textContent = `${total.toFixed(2)} EGP`; }

    function confirmModalSelection() {
        const selectedCodes = state.modalSelections;
        switch(modalContext) {
            case 'invoices':
                renderPaymentList();
                break;
            case 'receive':
                const newReceiveList = [];
                selectedCodes.forEach(code => { const existing = state.currentReceiveList.find(i => i.itemCode === code); if (existing) { newReceiveList.push(existing); } else { const item = findByKey(state.items, 'code', code); if(item) newReceiveList.push({ itemCode: item.code, itemName: item.name, quantity: 1, cost: item.cost }); }});
                state.currentReceiveList = newReceiveList; renderReceiveListTable();
                break;
            case 'transfer':
                const newTransferList = [];
                selectedCodes.forEach(code => { const existing = state.currentTransferList.find(i => i.itemCode === code); if (existing) { newTransferList.push(existing); } else { const item = findByKey(state.items, 'code', code); if (item) newTransferList.push({ itemCode: item.code, itemName: item.name, quantity: 1 }); }});
                state.currentTransferList = newTransferList; renderTransferListTable();
                break;
            case 'issue':
                const newIssueList = [];
                selectedCodes.forEach(code => { const existing = state.currentIssueList.find(i => i.itemCode === code); if (existing) { newIssueList.push(existing); } else { const item = findByKey(state.items, 'code', code); if (item) newIssueList.push({ itemCode: item.code, itemName: item.name, quantity: 1 }); }});
                state.currentIssueList = newIssueList; renderIssueListTable();
                break;
        }
        closeModal();
    }
    
    function showView(viewId) {
        Logger.info(`Switching view to: ${viewId}`);
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.querySelectorAll('#main-nav a').forEach(link => link.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');
        const activeLink = document.querySelector(`[data-view="${viewId}"]`);
        if (activeLink) { activeLink.classList.add('active'); document.getElementById('view-title').textContent = activeLink.querySelector('span').textContent; }
        
        if (viewId === 'receive') document.getElementById('receive-invoice').value = `GRN-${Date.now()}`;
        if (viewId === 'issue') document.getElementById('issue-ref').value = `ISN-${Date.now()}`;
        if (viewId !== 'receive') { state.currentReceiveList = []; if(document.getElementById('table-receive-list')) renderReceiveListTable(); }
        if (viewId !== 'transfer') { state.currentTransferList = []; if(document.getElementById('table-transfer-list')) renderTransferListTable(); }
        if (viewId !== 'issue') { state.currentIssueList = []; if(document.getElementById('table-issue-list')) renderIssueListTable(); }
        if (viewId !== 'payments') state.invoiceModalSelections.clear();

        refreshViewData(viewId);
    }

    function showToast(message, type = 'success') { if (type === 'error') Logger.error(`User Toast: ${message}`); const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.textContent = message; container.appendChild(toast); setTimeout(() => toast.remove(), 3500); }
    function setButtonLoading(isLoading, buttonEl) { if (!buttonEl) return; if (isLoading) { buttonEl.disabled = true; buttonEl.dataset.originalText = buttonEl.innerHTML; buttonEl.innerHTML = '<div class="button-spinner"></div><span>Processing...</span>'; } else { buttonEl.disabled = false; if (buttonEl.dataset.originalText) { buttonEl.innerHTML = buttonEl.dataset.originalText; } } }
    // PART 3 OF 4: VIEW RENDERING & DOCUMENT GENERATION

    function renderItemsTable(data = state.items) { const tbody = document.getElementById('table-items').querySelector('tbody'); tbody.innerHTML = ''; if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="5">No items found.</td></tr>'; return; } data.forEach(item => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.code}</td><td>${item.name}</td><td>${item.unit}</td><td>${parseFloat(item.cost).toFixed(2)} EGP</td><td><button class="secondary small btn-edit" data-type="item" data-id="${item.code}">Edit</button></td>`; tbody.appendChild(tr); }); }
    function renderSuppliersTable(data = state.suppliers) { const tbody = document.getElementById('table-suppliers').querySelector('tbody'); tbody.innerHTML = ''; if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="5">No suppliers found.</td></tr>'; return; } const financials = calculateSupplierFinancials(); data.forEach(supplier => { const balance = financials[supplier.supplierCode]?.balance || 0; const tr = document.createElement('tr'); tr.innerHTML = `<td>${supplier.supplierCode || ''}</td><td>${supplier.name}</td><td>${supplier.contact}</td><td>${balance.toFixed(2)} EGP</td><td><button class="secondary small btn-edit" data-type="supplier" data-id="${supplier.supplierCode}">Edit</button></td>`; tbody.appendChild(tr); }); }
    function renderBranchesTable(data = state.branches) { const tbody = document.getElementById('table-branches').querySelector('tbody'); tbody.innerHTML = ''; if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="3">No branches found.</td></tr>'; return; } data.forEach(branch => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${branch.branchCode || ''}</td><td>${branch.name}</td><td><button class="secondary small btn-edit" data-type="branch" data-id="${branch.branchCode}">Edit</button></td>`; tbody.appendChild(tr); }); }
    function renderSectionsTable(data = state.sections) { const tbody = document.getElementById('table-sections').querySelector('tbody'); tbody.innerHTML = ''; if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="3">No sections found.</td></tr>'; return; } data.forEach(section => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${section.sectionCode || ''}</td><td>${section.name}</td><td><button class="secondary small btn-edit" data-type="section" data-id="${section.sectionCode}">Edit</button></td>`; tbody.appendChild(tr); }); }
    
    function renderReceiveListTable() { const tbody = document.getElementById('table-receive-list').querySelector('tbody'); tbody.innerHTML = ''; if (state.currentReceiveList.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No items selected. Click "Select Items".</td></tr>'; updateReceiveGrandTotal(); return; } state.currentReceiveList.forEach((item, index) => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.itemCode}</td><td>${item.itemName}</td><td><input type="number" class="table-input" value="${item.quantity}" min="0.01" step="0.01" data-index="${index}" data-field="quantity"></td><td><input type="number" class="table-input" value="${item.cost.toFixed(2)}" min="0" step="0.01" data-index="${index}" data-field="cost"></td><td id="total-cost-${index}">${(item.quantity * item.cost).toFixed(2)} EGP</td><td><button class="danger small" data-index="${index}">X</button></td>`; tbody.appendChild(tr); }); updateReceiveGrandTotal(); }
    function renderTransferListTable() { const tbody = document.getElementById('table-transfer-list').querySelector('tbody'); const fromBranchCode = document.getElementById('transfer-from-branch').value; const stock = calculateStockLevels(); tbody.innerHTML = ''; if (state.currentTransferList.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No items selected. Click "Select Items".</td></tr>'; updateTransferGrandTotal(); return; } state.currentTransferList.forEach((item, index) => { const availableStock = stock[fromBranchCode]?.[item.itemCode]?.quantity || 0; const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.itemCode}</td><td>${item.itemName}</td><td>${availableStock.toFixed(2)}</td><td><input type="number" class="table-input" value="${item.quantity}" min="0.01" max="${availableStock}" step="0.01" data-index="${index}" data-field="quantity"></td><td><button class="danger small" data-index="${index}">X</button></td>`; tbody.appendChild(tr); }); updateTransferGrandTotal(); }
    function renderIssueListTable() { const tbody = document.getElementById('table-issue-list').querySelector('tbody'); const fromBranchCode = document.getElementById('issue-from-branch').value; const stock = calculateStockLevels(); tbody.innerHTML = ''; if (state.currentIssueList.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No items selected. Click "Select Items".</td></tr>'; updateIssueGrandTotal(); return; } state.currentIssueList.forEach((item, index) => { const availableStock = stock[fromBranchCode]?.[item.itemCode]?.quantity || 0; const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.itemCode}</td><td>${item.itemName}</td><td>${availableStock.toFixed(2)}</td><td><input type="number" class="table-input" value="${item.quantity}" min="0.01" max="${availableStock}" step="0.01" data-index="${index}" data-field="quantity"></td><td><button class="danger small" data-index="${index}">X</button></td>`; tbody.appendChild(tr); }); updateIssueGrandTotal(); }
    
    function renderItemCentricStockView(itemsToRender = state.items) { const container = document.getElementById('item-centric-stock-container'); const stockByBranch = calculateStockLevels(); let tableHTML = `<table id="table-stock-levels-by-item"><thead><tr><th>Code</th><th>Item Name</th>`; state.branches.forEach(b => { tableHTML += `<th>${b.name}</th>` }); tableHTML += `<th>Total</th></tr></thead><tbody>`; itemsToRender.forEach(item => { tableHTML += `<tr><td>${item.code}</td><td>${item.name}</td>`; let total = 0; state.branches.forEach(branch => { const qty = stockByBranch[branch.branchCode]?.[item.code]?.quantity || 0; total += qty; tableHTML += `<td>${qty > 0 ? qty.toFixed(2) : '-'}</td>`; }); tableHTML += `<td><strong>${total.toFixed(2)}</strong></td></tr>`; }); tableHTML += `</tbody></table>`; container.innerHTML = tableHTML; }
    function renderItemInquiry(searchTerm) { const resultsContainer = document.getElementById('item-inquiry-results'); if (!searchTerm) { resultsContainer.innerHTML = ''; return; } const stockByBranch = calculateStockLevels(); const filteredItems = state.items.filter(i => i.name.toLowerCase().includes(searchTerm) || i.code.toLowerCase().includes(searchTerm)); let html = ''; filteredItems.slice(0, 10).forEach(item => { html += `<h4>${item.name} (${item.code})</h4><table><thead><tr><th>Branch</th><th>Qty</th><th>Value</th></tr></thead><tbody>`; let found = false; let totalQty = 0; let totalValue = 0; state.branches.forEach(branch => { const itemStock = stockByBranch[branch.branchCode]?.[item.code]; if (itemStock && itemStock.quantity > 0) { const value = itemStock.quantity * itemStock.avgCost; html += `<tr><td>${branch.name} (${branch.branchCode || ''})</td><td>${itemStock.quantity.toFixed(2)}</td><td>${value.toFixed(2)} EGP</td></tr>`; totalQty += itemStock.quantity; totalValue += value; found = true; } }); if (!found) { html += `<tr><td colspan="3">No stock for this item.</td></tr>`; } else { html += `<tr style="font-weight:bold; background-color: var(--bg-color);"><td>Total</td><td>${totalQty.toFixed(2)}</td><td>${totalValue.toFixed(2)} EGP</td></tr>` } html += `</tbody></table><hr>`; }); resultsContainer.innerHTML = html; }

    function renderSupplierStatement(supplierCode, startDateStr, endDateStr) { const resultsContainer = document.getElementById('supplier-statement-results'); const supplier = findByKey(state.suppliers, 'supplierCode', supplierCode); if (!supplier) { return; } const financials = calculateSupplierFinancials(); const supplierData = financials[supplierCode]; const sDate = startDateStr ? new Date(startDateStr) : null; const eDate = endDateStr ? new Date(endDateStr) : null; if(eDate) eDate.setHours(23, 59, 59, 999); let openingBalance = 0; if (sDate) { supplierData.events.forEach(event => { if (new Date(event.date) < sDate) { openingBalance += event.debit - event.credit; } }); } const filteredEvents = supplierData.events.filter(event => { const eventDate = new Date(event.date); return (!sDate || eventDate >= sDate) && (!eDate || eventDate <= eDate); }); let balance = openingBalance; let tableBodyHtml = ''; if (sDate) { tableBodyHtml += `<tr style="background-color: var(--bg-color);"><td colspan="3"><strong>Opening Balance as of ${sDate.toLocaleDateString()}</strong></td><td>-</td><td>-</td><td><strong>${openingBalance.toFixed(2)} EGP</strong></td></tr>`; } filteredEvents.forEach(event => { balance += event.debit - event.credit; tableBodyHtml += `<tr><td>${new Date(event.date).toLocaleDateString()}</td><td>${event.type}</td><td>${event.ref}</td><td>${event.debit > 0 ? event.debit.toFixed(2) : '-'}</td><td>${event.credit > 0 ? event.credit.toFixed(2) : '-'}</td><td>${balance.toFixed(2)} EGP</td></tr>`; }); let dateHeader = `for all time`; if (sDate && eDate) { dateHeader = `from ${sDate.toLocaleDateString()} to ${eDate.toLocaleDateString()}`; } else if (sDate) { dateHeader = `from ${sDate.toLocaleDateString()}`; } else if (eDate) { dateHeader = `until ${eDate.toLocaleDateString()}`; } resultsContainer.innerHTML = `<div class="printable-document"><div class="printable-header"><div><h2>Supplier Statement: ${supplier.name}</h2><p style="margin:0; color: var(--text-light-color);">For period: ${dateHeader}</p></div><button class="secondary no-print" onclick="printReport('supplier-statement-results')">Print</button></div><p><strong>Date Generated:</strong> ${new Date().toLocaleString()}</p><div class="report-area"><table id="table-supplier-statement-report"><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>${tableBodyHtml}</tbody><tfoot><tr style="font-weight:bold; background-color: var(--bg-color);"><td colspan="5" style="text-align:right;">Closing Balance:</td><td>${balance.toFixed(2)} EGP</td></tr></tfoot></table></div></div>`; resultsContainer.style.display = 'block';}
    function renderBranchStatement(branchCode, startDateStr, endDateStr) { const resultsContainer = document.getElementById('branch-statement-results'); const branch = findByKey(state.branches, 'branchCode', branchCode); if (!branch) return; const sDate = startDateStr ? new Date(startDateStr) : null; const eDate = endDateStr ? new Date(endDateStr) : null; if(eDate) eDate.setHours(23, 59, 59, 999); const filteredTransactions = state.transactions.filter(t => { const eventDate = new Date(t.date); const isInvolved = t.branchCode === branchCode || t.fromBranchCode === branchCode || t.toBranchCode === branchCode; return isInvolved && (!sDate || eventDate >= sDate) && (!eDate || eventDate <= eDate); }).sort((a,b) => new Date(a.date) - new Date(b.date)); let tableBodyHtml = ''; filteredTransactions.forEach(t => { const item = findByKey(state.items, 'code', t.itemCode) || {name: 'N/A'}; let type = '', details = '', qtyIn = '-', qtyOut = '-'; if (t.type === 'receive' && t.branchCode === branchCode) { type = 'Receive'; details = `From: ${findByKey(state.suppliers, 'supplierCode', t.supplierCode)?.name || 'N/A'} (Ref: ${t.invoiceNumber})`; qtyIn = t.quantity.toFixed(2); } else if (t.type === 'issue' && t.fromBranchCode === branchCode) { type = 'Issue'; details = `To: ${findByKey(state.sections, 'sectionCode', t.sectionCode)?.name || 'N/A'} (Ref: ${t.invoiceNumber})`; qtyOut = t.quantity.toFixed(2); } else if (t.type === 'transfer' && t.fromBranchCode === branchCode) { type = 'Transfer Out'; details = `To: ${findByKey(state.branches, 'branchCode', t.toBranchCode)?.name || 'N/A'}`; qtyOut = t.quantity.toFixed(2); } else if (t.type === 'transfer' && t.toBranchCode === branchCode) { type = 'Transfer In'; details = `From: ${findByKey(state.branches, 'branchCode', t.fromBranchCode)?.name || 'N/A'}`; qtyIn = t.quantity.toFixed(2); } else { return; } tableBodyHtml += `<tr><td>${new Date(t.date).toLocaleString()}</td><td>${item.code}</td><td>${item.name}</td><td>${type}</td><td>${details}</td><td style="text-align:right;">${qtyIn}</td><td style="text-align:right;">${qtyOut}</td></tr>`; }); let dateHeader = "for all time"; if (sDate && eDate) { dateHeader = `from ${sDate.toLocaleDateString()} to ${eDate.toLocaleDateString()}`; } else if (sDate) { dateHeader = `from ${sDate.toLocaleDateString()}`; } else if (eDate) { dateHeader = `until ${eDate.toLocaleDateString()}`; } resultsContainer.innerHTML = `<div class="printable-document"><div class="printable-header"><div><h2>Branch Activity: ${branch.name}</h2><p style="margin:0; color: var(--text-light-color);">For period: ${dateHeader}</p></div><button class="secondary no-print" onclick="printReport('branch-statement-results')">Print</button></div><div class="report-area"><table id="table-branch-statement-report"><thead><tr><th>Date</th><th>Item Code</th><th>Item Name</th><th>Type</th><th>Details</th><th style="text-align:right;">Qty In</th><th style="text-align:right;">Qty Out</th></tr></thead><tbody>${tableBodyHtml}</tbody></table></div></div>`; resultsContainer.style.display = 'block'; }
    function renderSectionStatement(sectionCode, startDateStr, endDateStr) { const resultsContainer = document.getElementById('section-statement-results'); const section = findByKey(state.sections, 'sectionCode', sectionCode); if (!section) return; const sDate = startDateStr ? new Date(startDateStr) : null; const eDate = endDateStr ? new Date(endDateStr) : null; if(eDate) eDate.setHours(23, 59, 59, 999); const filteredTransactions = state.transactions.filter(t => { const eventDate = new Date(t.date); return t.type === 'issue' && t.sectionCode === sectionCode && (!sDate || eventDate >= sDate) && (!eDate || eventDate <= eDate); }).sort((a,b) => new Date(a.date) - new Date(b.date)); let tableBodyHtml = ''; let totalItems = 0; filteredTransactions.forEach(t => { const item = findByKey(state.items, 'code', t.itemCode) || {name: 'N/A', unit: 'N/A'}; const fromBranch = findByKey(state.branches, 'branchCode', t.fromBranchCode) || {name: 'N/A'}; totalItems += t.quantity; tableBodyHtml += `<tr><td>${new Date(t.date).toLocaleString()}</td><td>${t.invoiceNumber}</td><td>${item.code}</td><td>${item.name}</td><td>${fromBranch.name}</td><td style="text-align:right;">${t.quantity.toFixed(2)} ${item.unit}</td></tr>`; }); let dateHeader = "for all time"; if (sDate && eDate) { dateHeader = `from ${sDate.toLocaleDateString()} to ${eDate.toLocaleDateString()}`; } else if (sDate) { dateHeader = `from ${sDate.toLocaleDateString()}`; } else if (eDate) { dateHeader = `until ${eDate.toLocaleDateString()}`; } resultsContainer.innerHTML = `<div class="printable-document"><div class="printable-header"><div><h2>Section Usage: ${section.name}</h2><p style="margin:0; color: var(--text-light-color);">For period: ${dateHeader}</p></div><button class="secondary no-print" onclick="printReport('section-statement-results')">Print</button></div><div class="report-area"><table id="table-section-statement-report"><thead><tr><th>Date</th><th>Ref #</th><th>Item Code</th><th>Item Name</th><th>From Branch</th><th style="text-align:right;">Quantity Issued</th></tr></thead><tbody>${tableBodyHtml}</tbody><tfoot><tr style="font-weight:bold; background-color: var(--bg-color);"><td colspan="5" style="text-align:right;">Total Items:</td><td style="text-align:right;">${totalItems.toFixed(2)}</td></tr></tfoot></table></div></div>`; resultsContainer.style.display = 'block'; }
    function renderTransactionHistory(filter = '') { const tbody = document.getElementById('table-transaction-history').querySelector('tbody'); tbody.innerHTML = ''; const lowerFilter = filter.toLowerCase(); const invoiceFinances = calculateSupplierFinancials().allInvoices; const grouped = {}; state.transactions.forEach(t => { const key = t.batchId; if (!grouped[key]) { grouped[key] = { date: t.date, type: t.type, batchId: key, invoiceNumber: t.invoiceNumber, transactions: [] }; } grouped[key].transactions.push(t); }); Object.values(grouped).sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(group => { const first = group.transactions[0]; let details = '', searchableText = `${group.batchId} ${first.invoiceNumber || ''} ${first.type}`, statusTag = '', refNum = first.invoiceNumber || first.batchId; if (first.type === 'receive') { const status = invoiceFinances[first.invoiceNumber]?.status || 'Unpaid'; statusTag = `<span class="status-tag status-${status.toLowerCase()}">${status}</span>`; const supplier = findByKey(state.suppliers, 'supplierCode', first.supplierCode); const branch = findByKey(state.branches, 'branchCode', first.branchCode); details = `Received ${group.transactions.length} item(s) from <strong>${supplier?.name || 'N/A'}</strong> to <strong>${branch?.name || 'N/A'}</strong>`; searchableText += ` ${supplier?.name} ${branch?.name}`; } else if (first.type === 'transfer') { const from = findByKey(state.branches, 'branchCode', first.fromBranchCode); const to = findByKey(state.branches, 'branchCode', first.toBranchCode); details = `Transferred ${group.transactions.length} item(s) from <strong>${from?.name || 'N/A'}</strong> to <strong>${to?.name || 'N/A'}</strong>`; searchableText += ` ${from?.name} ${to?.name}`; } else if (first.type === 'issue') { const from = findByKey(state.branches, 'branchCode', first.fromBranchCode); const to = findByKey(state.sections, 'sectionCode', first.sectionCode); details = `Issued ${group.transactions.length} item(s) from <strong>${from?.name || 'N/A'}</strong> to <strong>${to?.name || 'N/A'}</strong>`; searchableText += ` ${from?.name} ${to?.name}`; refNum = first.invoiceNumber; } if (filter && !searchableText.toLowerCase().includes(lowerFilter)) return; const tr = document.createElement('tr'); tr.innerHTML = `<td>${new Date(first.date).toLocaleString()}</td><td>${first.type.charAt(0).toUpperCase() + first.type.slice(1)}</td><td>${refNum}</td><td>${details}</td><td>${statusTag}</td><td><button class="secondary small no-print" data-batch-id="${group.batchId}" data-type="${first.type}">View/Print</button></td>`; tbody.appendChild(tr); }); }
    function renderActivityLog() { const tbody = document.getElementById('table-activity-log').querySelector('tbody'); tbody.innerHTML = ''; state.activityLog.slice().reverse().forEach(log => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${new Date(log.timestamp).toLocaleString()}</td><td>${log.action}</td><td>${log.description}</td>`; tbody.appendChild(tr); }); }
    
    // Document Generation
    const generateReceiveDocument = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; const branch = findByKey(state.branches, 'branchCode', data.branchCode) || { name: 'DELETED' }; let itemsHtml = '', totalValue = 0; data.items.forEach(item => { const itemTotal = item.quantity * item.cost; totalValue += itemTotal; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName}</td><td>${item.quantity.toFixed(2)}</td><td>${item.cost.toFixed(2)} EGP</td><td>${itemTotal.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card"><h2>Goods Received Note</h2><p><strong>GRN No:</strong> ${data.batchId}</p><p><strong>Invoice #:</strong> ${data.invoiceNumber}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><p><strong>Supplier:</strong> ${supplier.name} (${supplier.supplierCode || ''})</p><p><strong>Received at:</strong> ${branch.name} (${branch.branchCode || ''})</p><hr><h3>Items Received</h3><table><thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Cost/Unit</th><th>Total</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold;">Total Value</td><td style="font-weight:bold;">${totalValue.toFixed(2)} EGP</td></tr></tfoot></table><hr><p><strong>Notes:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Signature:</strong> _________________________</p></div>`; printContent(content); }
    const generateTransferDocument = (data) => { const fromBranch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { name: 'DELETED' }; const toBranch = findByKey(state.branches, 'branchCode', data.toBranchCode) || { name: 'DELETED' }; let itemsHtml = ''; data.items.forEach(item => { const fullItem = findByKey(state.items, 'code', item.itemCode) || { code: 'N/A', name: 'DELETED', unit: 'N/A' }; itemsHtml += `<tr><td>${fullItem.code}</td><td>${fullItem.name}</td><td>${item.quantity.toFixed(2)}</td><td>${fullItem.unit}</td></tr>`; }); const content = `<div class="printable-document card"><h2>Internal Transfer Order</h2><p><strong>Order ID:</strong> ${data.batchId}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>From:</strong> ${fromBranch.name} (${fromBranch.branchCode || ''})</p><p><strong>To:</strong> ${toBranch.name} (${toBranch.branchCode || ''})</p><hr><h3>Items Transferred</h3><table><thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${itemsHtml}</tbody></table><hr><p><strong>Notes:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Sender:</strong> _________________</p><p><strong>Receiver:</strong> _________________</p></div>`; printContent(content); }
    const generateIssueDocument = (data) => { const fromBranch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { name: 'DELETED' }; const toSection = findByKey(state.sections, 'sectionCode', data.sectionCode) || { name: 'DELETED' }; let itemsHtml = ''; data.items.forEach(item => { const fullItem = findByKey(state.items, 'code', item.itemCode) || { name: 'DELETED', unit: 'N/A' }; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName || fullItem.name}</td><td>${item.quantity.toFixed(2)}</td><td>${fullItem.unit}</td></tr>`; }); const content = `<div class="printable-document card"><h2>Stock Issue Note</h2><p><strong>Issue Ref #:</strong> ${data.ref}</p><p><strong>Batch ID:</strong> ${data.batchId}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>From Branch:</strong> ${fromBranch.name} (${fromBranch.branchCode || ''})</p><p><strong>To Section:</strong> ${toSection.name} (${toSection.sectionCode || ''})</p><hr><h3>Items Issued</h3><table><thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${itemsHtml}</tbody></table><hr><p><strong>Notes:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Issued By:</strong> _________________</p><p><strong>Received By:</strong> _________________</p></div>`; printContent(content); }
    const generatePaymentVoucher = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; let invoicesHtml = ''; data.payments.forEach(p => { invoicesHtml += `<tr><td>${p.invoiceNumber}</td><td>${p.amount.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card"><h2>Payment Voucher</h2><p><strong>Voucher ID:</strong> ${data.payments[0].paymentId}</p><p><strong>Date:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>Paid To:</strong> ${supplier.name} (${supplier.supplierCode || ''})</p><p><strong>Amount:</strong> ${data.totalAmount.toFixed(2)} EGP</p><p><strong>Method:</strong> ${data.method}</p><hr><h3>Payment Allocation</h3><table><thead><tr><th>Invoice #</th><th>Amount Paid</th></tr></thead><tbody>${invoicesHtml}</tbody></table><br><p><strong>Signature:</strong> _________________</p></div>`; printContent(content); }
    // PART 4 OF 4: CALCULATION ENGINES, EVENT LISTENERS & INITIALIZATION

    function updateReceiveGrandTotal() { let grandTotal = 0; state.currentReceiveList.forEach(item => { grandTotal += (item.quantity || 0) * (item.cost || 0); }); document.getElementById('receive-grand-total').textContent = `${grandTotal.toFixed(2)} EGP`; }
    function updateTransferGrandTotal() { let grandTotalQty = 0; state.currentTransferList.forEach(item => { grandTotalQty += item.quantity || 0; }); document.getElementById('transfer-grand-total').textContent = grandTotalQty.toFixed(2); }
    function updateIssueGrandTotal() { let grandTotalQty = 0; state.currentIssueList.forEach(item => { grandTotalQty += item.quantity || 0; }); document.getElementById('issue-grand-total').textContent = grandTotalQty.toFixed(2); }
    
    async function handleTransactionSubmit(payload, buttonEl) {
        const result = await postData('addTransactionBatch', payload, buttonEl);
        if (result) {
            const newTransactions = result.data.items.map(item => {
                let base = { ...result.data };
                delete base.items; 
                if (payload.type === 'issue') {
                    base.invoiceNumber = payload.ref;
                }
                return { ...base, ...item, quantity: parseFloat(item.quantity), cost: parseFloat(item.cost || 0) };
            });
            state.transactions.push(...newTransactions);

            showToast(`${payload.type.charAt(0).toUpperCase() + payload.type.slice(1)} processed!`, 'success');
            
            const currentView = document.querySelector('.view.active').id.replace('view-', '');
            
            if (payload.type === 'receive') {
                generateReceiveDocument(result.data);
                state.currentReceiveList = [];
                document.getElementById('form-receive-details').reset();
                document.getElementById('receive-invoice').value = `GRN-${Date.now()}`;
            } else if (payload.type === 'transfer') {
                generateTransferDocument(result.data);
                state.currentTransferList = [];
                document.getElementById('form-transfer-details').reset();
            } else if (payload.type === 'issue') {
                generateIssueDocument(result.data);
                state.currentIssueList = [];
                document.getElementById('form-issue-details').reset();
                document.getElementById('issue-ref').value = `ISN-${Date.now()}`;
            }

            refreshViewData(currentView);
            setTimeout(() => reloadDataAndRefreshUI(), 2000); 
        }
    }

    const findByKey = (array, key, value) => (array || []).find(el => String(el[key]) === String(value));
    const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const printContent = (content) => { document.getElementById('print-area').innerHTML = content; setTimeout(() => window.print(), 100); }
    const exportToExcel = (tableId, filename) => { try { const table = document.getElementById(tableId); if (!table) { showToast('Please generate a report first.', 'error'); return; } const wb = XLSX.utils.table_to_book(table, {sheet: "Sheet1"}); XLSX.writeFile(wb, filename); showToast('Exporting to Excel...', 'success'); } catch (err) { showToast('Excel export failed.', 'error'); Logger.error('Export Error:', err); } };
    
    // Calculation Engines
    const calculateStockLevels = () => {
        const stock = {};
        (state.branches || []).forEach(branch => { stock[branch.branchCode] = {}; });
        const sortedTransactions = [...(state.transactions || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
        sortedTransactions.forEach(t => {
            const item = findByKey(state.items, 'code', t.itemCode);
            if (!item) return; 
            if (t.type === 'receive') {
                const branchCode = t.branchCode;
                if (!branchCode || !stock.hasOwnProperty(branchCode)) return;
                const current = stock[branchCode][t.itemCode] || { quantity: 0, avgCost: 0, itemName: item.name };
                const totalValue = (current.quantity * current.avgCost) + (t.quantity * t.cost);
                const totalQty = current.quantity + t.quantity;
                stock[branchCode][t.itemCode] = { itemCode: t.itemCode, quantity: totalQty, avgCost: totalQty > 0 ? totalValue / totalQty : 0, itemName: item.name };
            } else if (t.type === 'transfer') {
                const fromBranchCode = t.fromBranchCode; const toBranchCode = t.toBranchCode;
                if (!fromBranchCode || !toBranchCode || !stock.hasOwnProperty(fromBranchCode) || !stock.hasOwnProperty(toBranchCode)) return;
                if (stock[fromBranchCode][t.itemCode]) {
                    const fromStock = stock[fromBranchCode][t.itemCode]; fromStock.quantity -= t.quantity;
                    const toStock = stock[toBranchCode][t.itemCode] || { quantity: 0, avgCost: 0, itemName: item.name };
                    const newTotalValue = (toStock.quantity * toStock.avgCost) + (t.quantity * fromStock.avgCost);
                    const newTotalQty = toStock.quantity + t.quantity;
                    stock[toBranchCode][t.itemCode] = { itemCode: t.itemCode, quantity: newTotalQty, avgCost: newTotalQty > 0 ? newTotalValue / newTotalQty : 0, itemName: item.name };
                }
            } else if (t.type === 'issue') {
                const fromBranchCode = t.fromBranchCode;
                if (!fromBranchCode || !stock.hasOwnProperty(fromBranchCode)) return;
                if (stock[fromBranchCode][t.itemCode]) {
                    stock[fromBranchCode][t.itemCode].quantity -= t.quantity;
                }
            }
        });
        return stock;
    }
    const calculateSupplierFinancials = () => { const financials = {}; state.suppliers.forEach(s => { financials[s.supplierCode] = { supplierCode: s.supplierCode, supplierName: s.name, totalBilled: 0, totalPaid: 0, balance: 0, invoices: {}, events: [] }; }); state.transactions.forEach(t => { if (t.type === 'receive' && financials[t.supplierCode]) { const invoiceValue = t.quantity * t.cost; financials[t.supplierCode].totalBilled += invoiceValue; if (!financials[t.supplierCode].invoices[t.invoiceNumber]) { financials[t.supplierCode].invoices[t.invoiceNumber] = { number: t.invoiceNumber, date: t.date, total: 0, paid: 0 }; } financials[t.supplierCode].invoices[t.invoiceNumber].total += invoiceValue; } }); state.payments.forEach(p => { if (financials[p.supplierCode]) { financials[p.supplierCode].totalPaid += p.amount; if (p.invoiceNumber && financials[p.supplierCode].invoices[p.invoiceNumber]) { financials[p.supplierCode].invoices[p.invoiceNumber].paid += p.amount; } } }); Object.values(financials).forEach(s => { s.balance = s.totalBilled - s.totalPaid; Object.values(s.invoices).forEach(inv => { inv.balance = inv.total - inv.paid; if (Math.abs(inv.balance) < 0.01) { inv.status = 'Paid'; } else if (inv.paid > 0) { inv.status = 'Partial'; } else { inv.status = 'Unpaid'; } }); const allEvents = [ ...Object.values(s.invoices).map(i => ({ date: i.date, type: 'Invoice', ref: i.number, debit: i.total, credit: 0 })), ...state.payments.filter(p => p.supplierCode === s.supplierCode).map(p => ({ date: p.date, type: 'Payment', ref: p.invoiceNumber || 'On Account', debit: 0, credit: p.amount })) ]; s.events = allEvents.sort((a,b) => new Date(a.date) - new Date(b.date)); }); financials.allInvoices = {}; Object.values(financials).forEach(s => { Object.assign(financials.allInvoices, s.invoices); }); return financials; };
    const populateOptions = (el, data, ph, valueKey, textKey) => { el.innerHTML = `<option value="">${ph}</option>`; (data || []).forEach(item => { el.innerHTML += `<option value="${item[valueKey]}">${item[textKey]}${item[valueKey] ? ' (' + item[valueKey] + ')' : ''}</option>`; }); }
    
    const refreshViewData = (viewId) => {
        if (state.isLoading) return;
        switch(viewId) {
            case 'dashboard': const stock = calculateStockLevels(); document.getElementById('dashboard-total-items').textContent = (state.items || []).length; document.getElementById('dashboard-total-suppliers').textContent = (state.suppliers || []).length; document.getElementById('dashboard-total-branches').textContent = (state.branches || []).length; let totalValue = 0; Object.values(stock).forEach(bs => Object.values(bs).forEach(i => totalValue += i.quantity * i.avgCost)); document.getElementById('dashboard-total-value').textContent = `${totalValue.toFixed(2)} EGP`; break;
            case 'setup': populateOptions(document.getElementById('item-supplier'), state.suppliers, 'Select Supplier', 'supplierCode', 'name'); break;
            case 'master-data': renderItemsTable(); renderSuppliersTable(); renderBranchesTable(); renderSectionsTable(); break;
            case 'payments': populateOptions(document.getElementById('payment-supplier-select'), state.suppliers, 'Select Supplier', 'supplierCode', 'name'); renderPaymentList(); break;
            case 'financials': 
                populateOptions(document.getElementById('supplier-statement-select'), state.suppliers, 'Select a Supplier', 'supplierCode', 'name');
                populateOptions(document.getElementById('branch-statement-select'), state.branches, 'Select a Branch', 'branchCode', 'name');
                populateOptions(document.getElementById('section-statement-select'), state.sections, 'Select a Section', 'sectionCode', 'name');
                // Set first tab as active
                document.querySelector('.sub-nav-item[data-subview="supplier-statement"]').click();
                break;
            case 'receive': populateOptions(document.getElementById('receive-supplier'), state.suppliers, 'Select Supplier', 'supplierCode', 'name'); populateOptions(document.getElementById('receive-branch'), state.branches, 'Select Branch', 'branchCode', 'name'); renderReceiveListTable(); break;
            case 'transfer': populateOptions(document.getElementById('transfer-from-branch'), state.branches, 'Select Source', 'branchCode', 'name'); populateOptions(document.getElementById('transfer-to-branch'), state.branches, 'Select Destination', 'branchCode', 'name'); renderTransferListTable(); break;
            case 'issue': populateOptions(document.getElementById('issue-from-branch'), state.branches, 'Select Source', 'branchCode', 'name'); populateOptions(document.getElementById('issue-to-section'), state.sections, 'Select Destination', 'sectionCode', 'name'); renderIssueListTable(); break;
            case 'stock-levels': renderItemCentricStockView(); document.getElementById('item-inquiry-search').value = ''; renderItemInquiry(''); document.getElementById('stock-levels-search').value = ''; break;
            case 'transaction-history': renderTransactionHistory(); break;
            case 'activity-log': renderActivityLog(); break;
        }
    }
    async function reloadDataAndRefreshUI() { Logger.info('Reloading data...'); const currentView = document.querySelector('.nav-item a.active')?.dataset.view || 'dashboard'; await loadData(); refreshViewData(currentView); Logger.info('Reload complete.'); }
    
    function setupSearch(inputId, renderFn, dataKey, searchKeys) {
        const searchInput = document.getElementById(inputId);
        if (!searchInput) return;
        searchInput.addEventListener('input', e => {
            const searchTerm = e.target.value.toLowerCase();
            const dataToFilter = state[dataKey] || [];
            renderFn(searchTerm ? dataToFilter.filter(item => searchKeys.some(key => item[key] && String(item[key]).toLowerCase().includes(searchTerm))) : dataToFilter);
        });
    }

    function attachSubNavListeners() {
        document.querySelectorAll('.sub-nav-item').forEach(button => {
            button.addEventListener('click', e => {
                const subviewId = e.target.dataset.subview;
                
                // Handle button active state
                document.querySelectorAll('.sub-nav-item').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                // Handle view visibility
                document.querySelectorAll('.sub-view').forEach(view => view.classList.remove('active'));
                document.getElementById(`subview-${subviewId}`).classList.add('active');
            });
        });
    }

    function attachEventListeners() {
        document.querySelectorAll('#main-nav a').forEach(link => { link.addEventListener('click', e => { e.preventDefault(); showView(link.dataset.view); }); });
        
        document.getElementById('btn-show-receive-modal').addEventListener('click', openItemSelectorModal);
        document.getElementById('btn-show-transfer-modal').addEventListener('click', openItemSelectorModal);
        document.getElementById('btn-show-issue-modal').addEventListener('click', openItemSelectorModal);
        document.getElementById('btn-close-item-selector-modal').addEventListener('click', closeModal);
        document.getElementById('btn-cancel-item-selector-modal').addEventListener('click', closeModal);
        document.getElementById('btn-confirm-modal-selection').addEventListener('click', confirmModalSelection);
        modalItemList.addEventListener('change', handleModalCheckboxChange);
        modalSearchInput.addEventListener('input', e => renderItemsInModal(e.target.value));

        document.getElementById('btn-select-invoices').addEventListener('click', () => { if (document.getElementById('payment-supplier-select').value) { openInvoiceSelectorModal(); } else { showToast('Please select a supplier first.', 'error'); } });
        document.getElementById('btn-close-invoice-modal').addEventListener('click', closeModal);
        document.getElementById('btn-cancel-invoice-modal').addEventListener('click', closeModal);
        document.getElementById('btn-confirm-invoice-selection').addEventListener('click', confirmModalSelection);
        document.getElementById('modal-invoice-list').addEventListener('change', handleInvoiceModalCheckboxChange);
        document.getElementById('payment-supplier-select').addEventListener('change', e => { document.getElementById('btn-select-invoices').disabled = !e.target.value; state.invoiceModalSelections.clear(); renderPaymentList(); });
        document.getElementById('table-payment-list').addEventListener('input', handlePaymentInputChange);
        
        document.getElementById('btn-close-edit-modal').addEventListener('click', closeModal);
        document.getElementById('btn-cancel-edit-modal').addEventListener('click', closeModal);
        formEditRecord.addEventListener('submit', handleUpdateSubmit);
        
        document.getElementById('view-master-data').addEventListener('click', e => { if (e.target.classList.contains('btn-edit')) { openEditModal(e.target.dataset.type, e.target.dataset.id); } });

        document.getElementById('form-add-item').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const code = document.getElementById('item-code').value; if (findByKey(state.items, 'code', code)) { showToast(`Item code "${code}" already exists.`, 'error'); return; } const data = { code: code, barcode: document.getElementById('item-barcode').value, name: document.getElementById('item-name').value, unit: document.getElementById('item-unit').value, supplierCode: document.getElementById('item-supplier').value, cost: parseFloat(document.getElementById('item-cost').value) }; if (!data.name || !data.code || !data.unit || isNaN(data.cost)) { showToast("Please fill all required fields.", "error"); return; } const result = await postData('addItem', data, btn); if (result) { showToast('Item added!', 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-add-supplier').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const code = document.getElementById('supplier-code').value; if (findByKey(state.suppliers, 'supplierCode', code)) { showToast(`Supplier code "${code}" already exists.`, 'error'); return; } const data = { supplierCode: code, name: document.getElementById('supplier-name').value, contact: document.getElementById('supplier-contact').value }; if (!data.name || !data.supplierCode) { showToast("Supplier name and code are required.", "error"); return; } const result = await postData('addSupplier', data, btn); if (result) { showToast('Supplier added!', 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-add-branch').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const code = document.getElementById('branch-code').value; if (findByKey(state.branches, 'branchCode', code)) { showToast(`Branch code "${code}" already exists.`, 'error'); return; } const data = { branchCode: code, name: document.getElementById('branch-name').value }; if (!data.name || !data.branchCode) { showToast("Branch name and code are required.", "error"); return; } const result = await postData('addBranch', data, btn); if (result) { showToast('Branch added!', 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-add-section').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const code = document.getElementById('section-code').value; if (findByKey(state.sections, 'sectionCode', code)) { showToast(`Section code "${code}" already exists.`, 'error'); return; } const data = { sectionCode: code, name: document.getElementById('section-name').value }; if (!data.name || !data.sectionCode) { showToast("Section name and code are required.", "error"); return; } const result = await postData('addSection', data, btn); if (result) { showToast('Section added!', 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        
        document.getElementById('form-record-payment').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const supplierCode = document.getElementById('payment-supplier-select').value; const method = document.getElementById('payment-method').value; let totalAmount = 0; const payments = []; if (!supplierCode || !method) { showToast("Please select a supplier and enter a payment method.", "error"); return; } document.querySelectorAll('.payment-amount-input').forEach(input => { const amount = parseFloat(input.value); if (amount > 0) { totalAmount += amount; payments.push({ paymentId: generateId(), date: new Date().toISOString(), supplierCode: supplierCode, invoiceNumber: input.dataset.invoice, amount: amount, method: method }); } }); if (payments.length === 0) { showToast("No payments to record. Please enter an amount > 0 for at least one invoice.", "error"); return; } const result = await postData('addPaymentBatch', { payments, totalAmount, supplierCode, date: new Date().toISOString(), method }, btn); if (result) { showToast(`${payments.length} payment(s) recorded!`, 'success'); generatePaymentVoucher(result.data); e.target.reset(); state.invoiceModalSelections.clear(); renderPaymentList(); reloadDataAndRefreshUI(); } });
        
        document.getElementById('btn-submit-receive-batch').addEventListener('click', async (e) => { const btn = e.currentTarget; const supplierCode = document.getElementById('receive-supplier').value, branchCode = document.getElementById('receive-branch').value, invoiceNumber = document.getElementById('receive-invoice').value, notes = document.getElementById('receive-notes').value; if (!supplierCode || !branchCode || !invoiceNumber || state.currentReceiveList.length === 0) { showToast('Please fill all GRN details and select at least one item.', 'error'); return; } const payload = { type: 'receive', batchId: generateId(), supplierCode, branchCode, invoiceNumber, date: new Date().toISOString(), items: state.currentReceiveList, notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-transfer-batch').addEventListener('click', async (e) => { const btn = e.currentTarget; const fromBranchCode = document.getElementById('transfer-from-branch').value, toBranchCode = document.getElementById('transfer-to-branch').value, notes = document.getElementById('transfer-notes').value; if (!fromBranchCode || !toBranchCode || fromBranchCode === toBranchCode || state.currentTransferList.length === 0) { showToast('Please select valid branches and add at least one item.', 'error'); return; } const payload = { type: 'transfer', batchId: generateId(), fromBranchCode, toBranchCode, date: new Date().toISOString(), items: state.currentTransferList, notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-issue-batch').addEventListener('click', async(e) => { const btn = e.currentTarget; const fromBranchCode = document.getElementById('issue-from-branch').value, sectionCode = document.getElementById('issue-to-section').value, ref = document.getElementById('issue-ref').value, notes = document.getElementById('issue-notes').value; if (!fromBranchCode || !sectionCode || !ref || state.currentIssueList.length === 0) { showToast('Please fill all issue details and select at least one item.', 'error'); return; } const payload = { type: 'issue', batchId: generateId(), fromBranchCode, sectionCode, ref, date: new Date().toISOString(), items: state.currentIssueList, notes }; await handleTransactionSubmit(payload, btn); });

        document.getElementById('table-receive-list').addEventListener('input', e => { if (e.target.classList.contains('table-input')) { const index = e.target.dataset.index; const field = e.target.dataset.field; const value = parseFloat(e.target.value); if (!isNaN(value)) { state.currentReceiveList[index][field] = value; const item = state.currentReceiveList[index]; document.getElementById(`total-cost-${index}`).textContent = `${(item.quantity * item.cost).toFixed(2)} EGP`; updateReceiveGrandTotal(); } } });
        document.getElementById('table-receive-list').addEventListener('click', e => { if (e.target.classList.contains('danger')) { const index = e.target.dataset.index; state.currentReceiveList.splice(index, 1); renderReceiveListTable(); } });
        document.getElementById('table-transfer-list').addEventListener('input', e => { if (e.target.classList.contains('table-input')) { state.currentTransferList[e.target.dataset.index][e.target.dataset.field] = parseFloat(e.target.value) || 0; updateTransferGrandTotal(); } });
        document.getElementById('table-transfer-list').addEventListener('click', e => { if (e.target.classList.contains('danger')) { const index = e.target.dataset.index; state.currentTransferList.splice(index, 1); renderTransferListTable(); } });
        document.getElementById('transfer-from-branch').addEventListener('change', renderTransferListTable);
        document.getElementById('table-issue-list').addEventListener('input', e => { if (e.target.classList.contains('table-input')) { state.currentIssueList[e.target.dataset.index][e.target.dataset.field] = parseFloat(e.target.value) || 0; updateIssueGrandTotal(); } });
        document.getElementById('table-issue-list').addEventListener('click', e => { if (e.target.classList.contains('danger')) { const index = e.target.dataset.index; state.currentIssueList.splice(index, 1); renderIssueListTable(); } });
        document.getElementById('issue-from-branch').addEventListener('change', renderIssueListTable);
        
        document.getElementById('btn-generate-supplier-statement').addEventListener('click', () => { const supplierCode = document.getElementById('supplier-statement-select').value; if (!supplierCode) { showToast('Please select a supplier.', 'error'); return; } const startDate = document.getElementById('statement-start-date').value; const endDate = document.getElementById('statement-end-date').value; if (startDate && endDate && new Date(startDate) > new Date(endDate)) { showToast('Start date cannot be after end date.', 'error'); return; } renderSupplierStatement(supplierCode, startDate, endDate); });
        document.getElementById('btn-generate-branch-statement').addEventListener('click', () => { const branchCode = document.getElementById('branch-statement-select').value; if (!branchCode) { showToast('Please select a branch.', 'error'); return; } const startDate = document.getElementById('branch-statement-start-date').value; const endDate = document.getElementById('branch-statement-end-date').value; if (startDate && endDate && new Date(startDate) > new Date(endDate)) { showToast('Start date cannot be after end date.', 'error'); return; } renderBranchStatement(branchCode, startDate, endDate); });
        document.getElementById('btn-generate-section-statement').addEventListener('click', () => { const sectionCode = document.getElementById('section-statement-select').value; if (!sectionCode) { showToast('Please select a section.', 'error'); return; } const startDate = document.getElementById('section-statement-start-date').value; const endDate = document.getElementById('section-statement-end-date').value; if (startDate && endDate && new Date(startDate) > new Date(endDate)) { showToast('Start date cannot be after end date.', 'error'); return; } renderSectionStatement(sectionCode, startDate, endDate); });
        
        document.getElementById('btn-export-supplier-statement').addEventListener('click', () => exportToExcel('table-supplier-statement-report', 'SupplierStatement.xlsx'));
        document.getElementById('btn-export-branch-statement').addEventListener('click', () => exportToExcel('table-branch-statement-report', 'BranchActivity.xlsx'));
        document.getElementById('btn-export-section-statement').addEventListener('click', () => exportToExcel('table-section-statement-report', 'SectionUsage.xlsx'));

        document.getElementById('item-inquiry-search').addEventListener('input', e => renderItemInquiry(e.target.value.toLowerCase()));
        document.getElementById('transaction-search').addEventListener('input', e => renderTransactionHistory(e.target.value));
        document.getElementById('table-transaction-history').addEventListener('click', e => { if (e.target.tagName === 'BUTTON' && e.target.dataset.batchId) { const batchId = e.target.dataset.batchId; const type = e.target.dataset.type; Logger.info(`Re-printing document for batch ${batchId}`); const transactionGroup = state.transactions.filter(t => t.batchId === batchId); if (transactionGroup.length > 0) { const first = transactionGroup[0]; const data = { ...first, notes: first.notes, items: transactionGroup.map(t => ({...t, itemName: findByKey(state.items, 'code', t.itemCode)?.name })) }; if (type === 'receive') generateReceiveDocument(data); else if (type === 'transfer') generateTransferDocument(data); else if (type === 'issue') generateIssueDocument(data); } } });
        
        document.getElementById('btn-export-items').addEventListener('click', () => exportToExcel('table-items', 'ItemList.xlsx'));
        document.getElementById('btn-export-suppliers').addEventListener('click', () => exportToExcel('table-suppliers', 'SupplierList.xlsx'));
        document.getElementById('btn-export-branches').addEventListener('click', () => exportToExcel('table-branches', 'BranchList.xlsx'));
        document.getElementById('btn-export-sections').addEventListener('click', () => exportToExcel('table-sections', 'SectionList.xlsx'));
        document.getElementById('btn-export-stock').addEventListener('click', () => exportToExcel('table-stock-levels-by-item', 'StockLevels.xlsx'));
    }

    async function init() {
        Logger.info('Application initializing...');
        await loadData();
        if (state.isLoading) { Logger.error('Initialization failed: data could not be loaded.'); return; }
        document.getElementById('app-loader').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        
        attachEventListeners();
        attachSubNavListeners(); // Attach listeners for the new sub-tabs
        setupSearch('search-items', renderItemsTable, 'items', ['name', 'code']);
        setupSearch('search-suppliers', renderSuppliersTable, 'suppliers', ['name', 'supplierCode']);
        setupSearch('search-branches', renderBranchesTable, 'branches', ['name', 'branchCode']);
        setupSearch('search-sections', renderSectionsTable, 'sections', ['name', 'sectionCode']);
        setupSearch('stock-levels-search', renderItemCentricStockView, 'items', ['name', 'code']);
        
        showView('dashboard');
        Logger.info('Application initialized successfully.');
    }
    
    init();
});
