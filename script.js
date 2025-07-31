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
        currentLanguage: 'en',
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
        backups: [],
        adminContextPromise: {},
    };
    let modalContext = null;

    // --- INTERNATIONALIZATION (i18n) ---
    const translations = {
        'en': {
            'packing_stock': 'Packing Stock',
            'login_prompt': 'Please enter your credentials to continue.',
            'username': 'Username',
            'password_code': 'Password / Login Code',
            'login': 'Login',
            'signing_in': 'Signing in...',
            'hi_user': 'Hi, {userFirstName}',
            'refresh_all_data': 'Refresh All Data',
            'dashboard': 'Dashboard',
            'stock_operations': 'Stock Operations',
            'purchasing': 'Purchasing',
            'requests': 'Requests',
            'payments': 'Payments',
            'reports': 'Reports',
            'stock_levels': 'Stock Levels',
            'transaction_history': 'Transaction History',
            'add_data': 'Add Data',
            'master_data': 'Master Data',
            'user_management': 'User Management',
            'backup_restore': 'Backup',
            'activity_log': 'Activity Log',
            'logout': 'Logout',
            'pending_requests_widget': 'Pending Requests: {count}',
            'branch': 'Branch',
            'section': 'Section',
            'total_items': 'Total Items',
            'total_stock_value': 'Total Stock Value',
            'total_suppliers': 'Total Suppliers',
            'total_branches': 'Total Branches',
            'add_new_item': 'Add New Item',
            'item_code': 'Item Code (Unique ID)',
            'barcode': 'Barcode',
            'item_name': 'Item Name',
            'unit': 'Unit (e.g., PCS, KG)',
            'category': 'Category',
            'select_category': 'Select Category',
            'packing': 'Packing',
            'cleaning': 'Cleaning',
            'default_supplier': 'Default Supplier',
            'select_supplier': 'Select Supplier',
            'default_cost': 'Default Cost',
            'add_item_btn': 'Add Item',
            'add_new_supplier': 'Add New Supplier',
            'supplier_code': 'Supplier Code (Unique ID)',
            'supplier_name': 'Supplier Name',
            'contact_info': 'Contact Info',
            'add_supplier_btn': 'Add Supplier',
            'add_new_branch': 'Add New Branch',
            'branch_code': 'Branch Code (Unique ID)',
            'branch_name': 'Branch Name',
            'add_branch_btn': 'Add Branch',
            'add_new_section': 'Add New Section',
            'section_code': 'Section Code (Unique ID)',
            'section_name': 'Section Name',
            'add_section_btn': 'Add Section',
            'auto_backup_settings': 'Automatic Backup Settings',
            'auto_backup_desc': 'Enable automatic backups to save a copy of your data periodically. Backups are stored in "StockApp Backups" in Google Drive.',
            'enable_auto_backups': 'Enable Automatic Backups',
            'backup_frequency': 'Backup Frequency',
            'daily_backup': 'Daily (at 2am)',
            'weekly_backup': 'Weekly (Sunday at 2am)',
            'manual_backup_restore': 'Manual Backup & Restore',
            'manual_backup_desc': 'Create an immediate backup or restore from a previously created file.',
            'create_new_manual_backup': 'Create New Manual Backup',
            'available_backups': 'Available Backups',
            'loading_backups': 'Loading backup list...',
            'no_backups_found': 'No backups found.',
            'backup_name': 'Backup Name',
            'date_created': 'Date Created',
            'actions': 'Actions',
            'open': 'Open',
            'restore': 'Restore',
            'items': 'Items',
            'suppliers': 'Suppliers',
            'branches': 'Branches',
            'sections': 'Sections',
            'item_list': 'Item List',
            'search_items_placeholder': 'Search by name, code, category...',
            'export_to_excel': 'Export to Excel',
            'table_h_code': 'Code',
            'table_h_name': 'Name',
            'table_h_category': 'Category',
            'table_h_unit': 'Unit',
            'table_h_cost': 'Default Cost',
            'table_h_actions': 'Actions',
            'no_items_found': 'No items found.',
            'edit': 'Edit',
            'history': 'History',
            'supplier_list': 'Supplier List',
            'search_suppliers_placeholder': 'Search by name or code...',
            'table_h_contact': 'Contact',
            'table_h_balance': 'Balance (Owed)',
            'no_suppliers_found': 'No suppliers found.',
            'branch_list': 'Branch List',
            'search_branches_placeholder': 'Search by name or code...',
            'no_branches_found': 'No branches found.',
            'section_list': 'Section List',
            'search_sections_placeholder': 'Search by name or code...',
            'no_sections_found': 'No sections found.',
            'record_payment': 'Record a Payment',
            'step1_select_supplier': '1. Select Supplier',
            'step2_select_invoices': '2. Select Invoices to Pay',
            'select_invoices_btn': 'Select Invoices...',
            'step3_payment_method': '3. Enter Payment Method',
            'payment_method_placeholder': 'e.g., Cash, Bank Transfer',
            'step4_confirm_amounts': '4. Confirm Amounts',
            'table_h_invoice_no': 'Invoice #',
            'table_h_balance_due': 'Balance Due',
            'table_h_amount_to_pay': 'Amount to Pay',
            'total_payment': 'Total Payment:',
            'submit_payment_btn': 'Submit Payment',
            'supplier_statement': 'Supplier Statement',
            'consumption_report': 'Consumption Report',
            'consumption_report_desc': 'Generate a detailed report of item consumption across selected branches and sections.',
            'select_a_supplier': 'Select a Supplier',
            'generate': 'Generate',
            'select_a_branch': 'Select a Branch',
            'all_items': 'All Items',
            'all_categories': 'All Categories',
            'all_branches': 'All Branches',
            'receive_stock': 'Receive Stock',
            'issue_stock': 'Issue Stock',
            'internal_transfer': 'Internal Transfer',
            'return_to_supplier': 'Return to Supplier',
            'in_transit_report': 'In-Transit Report',
            'adjustments': 'Adjustments',
            'pending_incoming_transfers': 'Pending Incoming Transfers',
            'table_h_date_sent': 'Date Sent',
            'table_h_from_branch': 'From Branch',
            'table_h_ref_no': 'Reference #',
            'view_confirm': 'View/Confirm',
            'receive_stock_from_supplier': 'Receive Stock from Supplier',
            'receive_against_po': 'Receive Against PO',
            'optional': '(Optional)',
            'select_a_po': 'Select a Purchase Order',
            'to_branch': 'To Branch',
            'notes_optional': 'Notes (Optional)',
            'items_to_be_received': 'Items to be Received',
            'table_h_quantity': 'Quantity',
            'table_h_cost_per_unit': 'Cost/Unit',
            'table_h_total': 'Total',
            'grand_total': 'Grand Total:',
            'select_items': 'Select Items',
            'submit_for_approval': 'Submit for Approval',
            'issue_note_details': 'Issue Note Details',
            'from_branch': 'From Branch',
            'to_section': 'To Section',
            'issue_ref_no': 'Issue Ref #',
            'items_to_be_issued': 'Items to be Issued',
            'table_h_available': 'Available',
            'table_h_qty_to_issue': 'Quantity to Issue',
            'total_items_to_issue': 'Total Items to Issue:',
            'confirm_issue_all': 'Confirm & Issue All Items',
            'send_stock_to_branch': 'Send Stock to Another Branch',
            'transfer_ref_no': 'Transfer Reference #',
            'items_to_be_transferred': 'Items to be Transferred',
            'table_h_qty_to_transfer': 'Quantity to Transfer',
            'total_items_to_transfer': 'Total Items to Transfer:',
            'confirm_transfer_all': 'Confirm & Transfer All Items',
            'credit_note_ref': 'Credit Note Ref #',
            'reason_for_return': 'Reason for Return (Optional)',
            'items_to_return': 'Items to Return',
            'table_h_qty_to_return': 'Qty to Return',
            'total_return_value': 'Total Return Value:',
            'confirm_return_all': 'Confirm & Return All Items',
            'goods_in_transit_report': 'Goods In-Transit Report',
            'table_h_to_branch': 'To Branch',
            'table_h_status': 'Status',
            'stock_count_adjustment': 'Stock Count Adjustment',
            'reference': 'Reference',
            'stocktake_example': 'e.g., Stocktake April 2024',
            'notes_reason': 'Notes / Reason',
            'items_to_adjust': 'Items to Adjust',
            'table_h_system_qty': 'System Qty',
            'table_h_physical_count': 'Physical Count',
            'table_h_adjustment': 'Adjustment',
            'process_stock_adjustment': 'Process Stock Adjustment',
            'supplier_opening_balance': 'Supplier Opening Balance Adjustment',
            'supplier_opening_balance_desc': 'Use this to set the initial amount owed to a supplier. This should typically only be done once per supplier when setting up.',
            'opening_balance_amount': 'Opening Balance (Amount Owed)',
            'set_opening_balance': 'Set Opening Balance',
            'create_po': 'Create Purchase Order',
            'view_pos': 'View Purchase Orders',
            'pending_approval': 'Pending Approval',
            'po_details': 'Purchase Order Details',
            'po_ref_no': 'PO Reference #',
            'items_to_order': 'Items to Order',
            'po_list': 'Purchase Order List',
            'table_h_po_no': 'PO #',
            'table_h_date': 'Date',
            'table_h_total_value': 'Total Value',
            'tx_pending_financial_approval': 'Transactions Pending Financial Approval',
            'table_h_type': 'Type',
            'table_h_details': 'Details',
            'table_h_amount': 'Amount',
            'my_requests': 'My Requests',
            'create_new_request': 'Create New Request',
            'request_type': 'Request Type',
            'req_items_from_branch': 'Request Items from Branch',
            'req_item_resupply': 'Request Item Resupply (Low Stock)',
            'notes_justification': 'Notes / Justification',
            'items_for_request': 'Items for Request',
            'submit_request': 'Submit Request',
            'my_request_history': 'My Request History',
            'table_h_req_id': 'ID',
            'table_h_items_req_issued': 'Items (Req/Issued)',
            'table_h_req_notes': 'Notes',
            'req_pending_approval': 'Requests Pending Approval',
            'print_list': 'Print List',
            'table_h_requested_by': 'Requested By',
            'stock_by_item': 'Stock by Item',
            'stock_by_item_your_branch': 'Stock by Item (Your Branch)',
            'stock_by_item_all_branches': 'Stock by Item (All Branches)',
            'search_items_stock_placeholder': 'Search by item name or code...',
            'item_stock_inquiry': 'Item Stock Inquiry (Drill-down)',
            'item_stock_inquiry_placeholder': 'Start typing an item name or code...',
            'no_stock_for_item': 'No stock for this item.',
            'table_h_qty': 'Qty',
            'table_h_value': 'Value',
            'transaction_log': 'Transaction Log',
            'all_types': 'All Types',
            'all_sections': 'All Sections',
            'search_tx_placeholder': 'Search by Ref#, Item Code/Name...',
            'table_h_batch_ref': 'Batch/Ref #',
            'view_print': 'View/Print',
            'users': 'Users',
            'add_new_user': 'Add New User',
            'table_h_fullname': 'Full Name',
            'table_h_role': 'Role',
            'table_h_assigned_branch_section': 'Assigned Branch/Section',
            'roles': 'Roles',
            'add_new_role': 'Add New Role',
            'table_h_rolename': 'Role Name',
            'system_activity_log': 'System Activity Log',
            'table_h_timestamp': 'Timestamp',
            'table_h_user': 'User',
            'table_h_action': 'Action',
            'table_h_description': 'Description',
            'select_items_modal_title': 'Select Items',
            'search_items_placeholder_modal': 'Search items...',
            'confirm_selection': 'Confirm Selection',
            'cancel': 'Cancel',
            'select_invoices_modal_title': 'Select Invoices to Pay',
            'edit_modal_title': 'Edit',
            'save_changes': 'Save Changes',
            'confirm_transfer_receipt_modal_title': 'Confirm Transfer Receipt',
            'reject': 'Reject',
            'confirm_receipt': 'Confirm Receipt',
            'item_history_modal_title': 'Item History',
            'price_history': 'Price History',
            'movement_history': 'Movement History',
            'close': 'Close',
            'edit_po_modal_title': 'Edit Purchase Order',
            'approve_request_modal_title': 'Approve Item Request',
            'confirm_and_issue': 'Confirm and Issue',
            'restore_from_backup_modal_title': 'Restore from Backup',
            'restore_from_backup_desc': 'You are about to restore data from the backup file:',
            'restore_step1': '1. Select which data sheets to restore.',
            'restore_step2': '2. Confirm this irreversible action.',
            'restore_danger_warning': 'EXTREME DANGER:',
            'restore_danger_text': 'This will permanently delete the current data in the selected live sheets and replace it with the data from the backup. This action CANNOT be undone.',
            'restore_prompt': 'Please type RESTORE into the box below to proceed.',
            'confirm_and_restore': 'Confirm and Restore Data',
            'session_error_toast': 'Session error. Please logout and login again.',
            'action_failed_toast': 'Action Failed: {errorMessage}',
            'data_refreshed_toast': 'Data refreshed!',
            'data_refresh_fail_toast': 'Could not refresh data. Please try again.',
            'backup_created_toast': 'Backup created: {fileName}',
            'backup_confirm_prompt': 'This will create a full, manual backup of the current spreadsheet. Continue?',
            'auto_backup_updated_toast': 'Automatic backup settings updated!',
            'auto_backup_failed_toast': 'Failed to update settings. Please try again.',
            'restore_select_sheet_toast': 'You must select at least one sheet to restore.',
            'restore_completed_toast': 'Restore completed successfully!',
            'restore_find_id_fail_toast': 'Could not find backup file ID.',
            'tx_processed_toast': '{txType} processed!',
            'tx_processed_approval_toast': '{txType} processed! Submitted for approval.',
            'select_po_first_toast': 'You must select a Purchase Order to receive stock.',
            'fill_required_fields_toast': 'Please fill all required fields and add items.',
            'status_approved': 'Approved',
            'status_pending': 'Pending Approval',
            'status_rejected': 'Rejected',
            'status_completed': 'Completed',
            'status_in_transit': 'In Transit',
            'status_cancelled': 'Cancelled',
            'po': 'Purchase Order',
            'receive': 'Receive',
            'transfer': 'Transfer',
            'issue': 'Issue',
            'return': 'Return',
            'stock_adjustment': 'Stock Adjustment',
            'history_for': 'History for: {itemName} ({itemCode})',
            'edit_item': 'Edit Item',
            'edit_supplier': 'Edit Supplier',
            'edit_branch': 'Edit Branch',
            'edit_section': 'Edit Section',
            'edit_user': 'Edit User',
            'add_new_user_title': 'Add New User',
            'edit_user_password_label': 'Password / Login Code (leave blank to keep unchanged)',
            'edit_user_password_label_new': 'Password / Login Code',
            'toggle_user_enable': 'Enable User',
            'toggle_user_disable': 'Disable User',
            'toggle_user_enable_confirm': 'Are you sure you want to enable this user? They will be able to log in again.',
            'toggle_user_disable_confirm': 'Are you sure you want to disable this user? They will not be able to log in.',
            'user_enabled_toast': 'User enabled successfully!',
            'user_disabled_toast': 'User disabled successfully!',
            'edit_permissions_for': 'Edit Permissions for {roleName}',
            'delete_role': 'Delete Role',
            'add_role_prompt': 'Enter new role name:',
            'update_success_toast': '{type} updated successfully!',
            'add_success_toast': '{type} added successfully!',
            'no_invoices_for_supplier': 'No invoices found for this supplier.',
            'no_unpaid_invoices': 'No unpaid invoices for this supplier.',
            'invoice_modal_details': 'Date: {date} | Amount Due: {balance} EGP',
            'no_items_selected_toast': 'No items selected. Click "Select Items".',
            'no_items_for_adjustment': 'No items selected for adjustment.',
            'report_period_all_time': 'for all time',
            'report_period_from_to': 'from {startDate} to {endDate}',
            'report_period_from': 'from {startDate}',
            'report_period_until': 'until {endDate}',
            'supplier_statement_title': 'Supplier Statement: {supplierName}',
            'date_generated': 'Date Generated:',
            'table_h_debit': 'Debit',
            'table_h_credit': 'Credit',
            'opening_balance_as_of': 'Opening Balance as of {date}',
            'closing_balance': 'Closing Balance:',
            'consumption_report_title': '{title}: {entityName}',
            'table_h_total_qty_consumed': 'Total Qty Consumed',
            'table_h_total_value_consumed': 'Total Value',
            'grand_total_value': 'Grand Total Value:',
            'price_change_log': 'Price Change Log',
            'table_h_old_cost': 'Old Cost',
            'table_h_new_cost': 'New Cost',
            'table_h_change': 'Change',
            'table_h_source': 'Source',
            'table_h_updated_by': 'Updated By',
            'no_price_history': 'No price history found for this item.',
            'no_movements_found': 'No movements found for the selected filters.',
            'table_h_qty_in': 'Qty In',
            'table_h_qty_out': 'Qty Out',
            'movement_details_receive': 'From: {supplier} To: {branch}',
            'movement_details_issue': 'From: {branch} To: {section}',
            'movement_details_transfer_out': 'Sent from: {fromBranch} To: {toBranch}',
            'movement_details_transfer_in': 'Received at: {toBranch} From: {fromBranch}',
            'movement_details_return': 'Returned from: {branch} To: {supplier}',
            'movement_details_adjustment': 'Stock count at: {branch}',
            'no_pending_financial_approval': 'No items are pending financial approval.',
            'approve': 'Approve',
            'approve_confirm_prompt': 'Are you sure you want to approve this {type}?',
            'reject_confirm_prompt': 'Are you sure you want to reject this {type}? This action cannot be undone.',
            'approved_toast': '{type} approved successfully!',
            'rejected_toast': '{type} rejected successfully!',
        },
        'ar': {
            'packing_stock': 'مخزون التعبئة',
            'login_prompt': 'الرجاء إدخال بيانات الاعتماد الخاصة بك للمتابعة.',
            'username': 'اسم المستخدم',
            'password_code': 'كلمة المرور / رمز الدخول',
            'login': 'تسجيل الدخول',
            'signing_in': 'جاري تسجيل الدخول...',
            'hi_user': 'مرحباً، {userFirstName}',
            'refresh_all_data': 'تحديث كل البيانات',
            'dashboard': 'لوحة التحكم',
            'stock_operations': 'عمليات المخزون',
            'purchasing': 'المشتريات',
            'requests': 'الطلبات',
            'payments': 'المدفوعات',
            'reports': 'التقارير',
            'stock_levels': 'مستويات المخزون',
            'transaction_history': 'سجل الحركات',
            'add_data': 'إضافة بيانات',
            'master_data': 'البيانات الرئيسية',
            'user_management': 'إدارة المستخدمين',
            'backup_restore': 'النسخ الاحتياطي',
            'activity_log': 'سجل النشاط',
            'logout': 'تسجيل الخروج',
            'pending_requests_widget': 'طلبات معلقة: {count}',
            'branch': 'الفرع',
            'section': 'القسم',
            'total_items': 'إجمالي الأصناف',
            'total_stock_value': 'إجمالي قيمة المخزون',
            'total_suppliers': 'إجمالي الموردين',
            'total_branches': 'إجمالي الفروع',
            'add_new_item': 'إضافة صنف جديد',
            'item_code': 'كود الصنف (فريد)',
            'barcode': 'الباركود',
            'item_name': 'اسم الصنف',
            'unit': 'الوحدة (مثال: قطعة، كجم)',
            'category': 'الفئة',
            'select_category': 'اختر الفئة',
            'packing': 'تغليف',
            'cleaning': 'تنظيف',
            'default_supplier': 'المورد الافتراضي',
            'select_supplier': 'اختر المورد',
            'default_cost': 'التكلفة الافتراضية',
            'add_item_btn': 'إضافة صنف',
            'add_new_supplier': 'إضافة مورد جديد',
            'supplier_code': 'كود المورد (فريد)',
            'supplier_name': 'اسم المورد',
            'contact_info': 'معلومات الاتصال',
            'add_supplier_btn': 'إضافة مورد',
            'add_new_branch': 'إضافة فرع جديد',
            'branch_code': 'كود الفرع (فريد)',
            'branch_name': 'اسم الفرع',
            'add_branch_btn': 'إضافة فرع',
            'add_new_section': 'إضافة قسم جديد',
            'section_code': 'كود القسم (فريد)',
            'section_name': 'اسم القسم',
            'add_section_btn': 'إضافة قسم',
            'auto_backup_settings': 'إعدادات النسخ الاحتياطي التلقائي',
            'auto_backup_desc': 'قم بتمكين النسخ الاحتياطي التلقائي لحفظ نسخة من بياناتك بشكل دوري. يتم تخزين النسخ الاحتياطية في "StockApp Backups" في Google Drive.',
            'enable_auto_backups': 'تمكين النسخ الاحتياطي التلقائي',
            'backup_frequency': 'تكرار النسخ الاحتياطي',
            'daily_backup': 'يوميًا (الساعة 2 صباحًا)',
            'weekly_backup': 'أسبوعيًا (الأحد الساعة 2 صباحًا)',
            'manual_backup_restore': 'النسخ الاحتياطي والاستعادة اليدوي',
            'manual_backup_desc': 'أنشئ نسخة احتياطية فورية أو قم بالاستعادة من ملف تم إنشاؤه مسبقًا.',
            'create_new_manual_backup': 'إنشاء نسخة احتياطية يدوية جديدة',
            'available_backups': 'النسخ الاحتياطية المتاحة',
            'loading_backups': 'جاري تحميل قائمة النسخ الاحتياطية...',
            'no_backups_found': 'لم يتم العثور على نسخ احتياطية.',
            'backup_name': 'اسم النسخة الاحتياطية',
            'date_created': 'تاريخ الإنشاء',
            'actions': 'الإجراءات',
            'open': 'فتح',
            'restore': 'استعادة',
            'items': 'الأصناف',
            'suppliers': 'الموردون',
            'branches': 'الفروع',
            'sections': 'الأقسام',
            'item_list': 'قائمة الأصناف',
            'search_items_placeholder': 'ابحث بالاسم، الكود، الفئة...',
            'export_to_excel': 'تصدير إلى Excel',
            'table_h_code': 'الكود',
            'table_h_name': 'الاسم',
            'table_h_category': 'الفئة',
            'table_h_unit': 'الوحدة',
            'table_h_cost': 'التكلفة الافتراضية',
            'table_h_actions': 'الإجراءات',
            'no_items_found': 'لم يتم العثور على أصناف.',
            'edit': 'تعديل',
            'history': 'السجل',
            'supplier_list': 'قائمة الموردين',
            'search_suppliers_placeholder': 'ابحث بالاسم أو الكود...',
            'table_h_contact': 'جهة الاتصال',
            'table_h_balance': 'الرصيد (مستحق)',
            'no_suppliers_found': 'لم يتم العثور على موردين.',
            'branch_list': 'قائمة الفروع',
            'search_branches_placeholder': 'ابحث بالاسم أو الكود...',
            'no_branches_found': 'لم يتم العثور على فروع.',
            'section_list': 'قائمة الأقسام',
            'search_sections_placeholder': 'ابحث بالاسم أو الكود...',
            'no_sections_found': 'لم يتم العثور على أقسام.',
            'record_payment': 'تسجيل دفعة',
            'step1_select_supplier': '1. اختر المورد',
            'step2_select_invoices': '2. اختر الفواتير للدفع',
            'select_invoices_btn': 'اختيار الفواتير...',
            'step3_payment_method': '3. أدخل طريقة الدفع',
            'payment_method_placeholder': 'مثال: نقدًا، تحويل بنكي',
            'step4_confirm_amounts': '4. تأكيد المبالغ',
            'table_h_invoice_no': 'رقم الفاتورة',
            'table_h_balance_due': 'الرصيد المستحق',
            'table_h_amount_to_pay': 'المبلغ المدفوع',
            'total_payment': 'إجمالي الدفعة:',
            'submit_payment_btn': 'إرسال الدفعة',
            'supplier_statement': 'كشف حساب مورد',
            'consumption_report': 'تقرير الاستهلاك',
            'consumption_report_desc': 'إنشاء تقرير مفصل لاستهلاك الأصناف عبر الفروع والأقسام المحددة.',
            'select_a_supplier': 'اختر موردًا',
            'generate': 'إنشاء',
            'select_a_branch': 'اختر فرعًا',
            'all_items': 'كل الأصناف',
            'all_categories': 'كل الفئات',
            'all_branches': 'كل الفروع',
            'receive_stock': 'استلام بضاعة',
            'issue_stock': 'صرف بضاعة',
            'internal_transfer': 'تحويل داخلي',
            'return_to_supplier': 'مرتجع للمورد',
            'in_transit_report': 'تقرير البضاعة بالطريق',
            'adjustments': 'التسويات',
            'pending_incoming_transfers': 'تحويلات واردة معلقة',
            'table_h_date_sent': 'تاريخ الإرسال',
            'table_h_from_branch': 'من فرع',
            'table_h_ref_no': 'رقم المرجع',
            'view_confirm': 'عرض/تأكيد',
            'receive_stock_from_supplier': 'استلام بضاعة من مورد',
            'receive_against_po': 'استلام مقابل طلب شراء',
            'optional': '(اختياري)',
            'select_a_po': 'اختر طلب شراء',
            'to_branch': 'إلى فرع',
            'notes_optional': 'ملاحظات (اختياري)',
            'items_to_be_received': 'الأصناف المراد استلامها',
            'table_h_quantity': 'الكمية',
            'table_h_cost_per_unit': 'التكلفة/الوحدة',
            'table_h_total': 'الإجمالي',
            'grand_total': 'الإجمالي الكلي:',
            'select_items': 'اختيار الأصناف',
            'submit_for_approval': 'إرسال للموافقة',
            'issue_note_details': 'تفاصيل إذن الصرف',
            'from_branch': 'من فرع',
            'to_section': 'إلى قسم',
            'issue_ref_no': 'رقم مرجع الصرف',
            'items_to_be_issued': 'الأصناف المراد صرفها',
            'table_h_available': 'المتاح',
            'table_h_qty_to_issue': 'الكمية المصروفة',
            'total_items_to_issue': 'إجمالي الأصناف المصروفة:',
            'confirm_issue_all': 'تأكيد وصرف كل الأصناف',
            'send_stock_to_branch': 'إرسال بضاعة لفرع آخر',
            'transfer_ref_no': 'رقم مرجع التحويل',
            'items_to_be_transferred': 'الأصناف المراد تحويلها',
            'table_h_qty_to_transfer': 'الكمية المحولة',
            'total_items_to_transfer': 'إجمالي الأصناف المحولة:',
            'confirm_transfer_all': 'تأكيد وتحويل كل الأصناف',
            'credit_note_ref': 'رقم مرجع إشعار الدائن',
            'reason_for_return': 'سبب الإرجاع (اختياري)',
            'items_to_return': 'الأصناف المراد إرجاعها',
            'table_h_qty_to_return': 'الكمية المرتجعة',
            'total_return_value': 'إجمالي قيمة المرتجع:',
            'confirm_return_all': 'تأكيد وإرجاع كل الأصناف',
            'goods_in_transit_report': 'تقرير البضاعة بالطريق',
            'table_h_to_branch': 'إلى فرع',
            'table_h_status': 'الحالة',
            'stock_count_adjustment': 'تسوية جرد المخزون',
            'reference': 'المرجع',
            'stocktake_example': 'مثال: جرد أبريل 2024',
            'notes_reason': 'ملاحظات / سبب',
            'items_to_adjust': 'الأصناف المراد تسويتها',
            'table_h_system_qty': 'كمية النظام',
            'table_h_physical_count': 'العد الفعلي',
            'table_h_adjustment': 'التسوية',
            'process_stock_adjustment': 'تنفيذ تسوية المخزون',
            'supplier_opening_balance': 'تسوية الرصيد الافتتاحي للمورد',
            'supplier_opening_balance_desc': 'استخدم هذا لتعيين المبلغ الأولي المستحق للمورد. يجب أن يتم ذلك عادة مرة واحدة فقط لكل مورد عند الإعداد.',
            'opening_balance_amount': 'الرصيد الافتتاحي (المبلغ المستحق)',
            'set_opening_balance': 'تعيين الرصيد الافتتاحي',
            'create_po': 'إنشاء طلب شراء',
            'view_pos': 'عرض طلبات الشراء',
            'pending_approval': 'قيد الموافقة',
            'po_details': 'تفاصيل طلب الشراء',
            'po_ref_no': 'رقم مرجع طلب الشراء',
            'items_to_order': 'الأصناف المطلوبة',
            'po_list': 'قائمة طلبات الشراء',
            'table_h_po_no': 'رقم طلب الشراء',
            'table_h_date': 'التاريخ',
            'table_h_total_value': 'القيمة الإجمالية',
            'tx_pending_financial_approval': 'حركات تنتظر الموافقة المالية',
            'table_h_type': 'النوع',
            'table_h_details': 'التفاصيل',
            'table_h_amount': 'المبلغ',
            'my_requests': 'طلباتي',
            'create_new_request': 'إنشاء طلب جديد',
            'request_type': 'نوع الطلب',
            'req_items_from_branch': 'طلب أصناف من الفرع',
            'req_item_resupply': 'طلب إعادة تزويد أصناف (نقص مخزون)',
            'notes_justification': 'ملاحظات / مبرر',
            'items_for_request': 'أصناف للطلب',
            'submit_request': 'إرسال الطلب',
            'my_request_history': 'سجل طلباتي',
            'table_h_req_id': 'المعرف',
            'table_h_items_req_issued': 'الأصناف (مطلوب/مصروف)',
            'table_h_req_notes': 'ملاحظات',
            'req_pending_approval': 'طلبات تنتظر الموافقة',
            'print_list': 'طباعة القائمة',
            'table_h_requested_by': 'مقدم الطلب',
            'stock_by_item': 'المخزون حسب الصنف',
            'stock_by_item_your_branch': 'المخزون حسب الصنف (فرعك)',
            'stock_by_item_all_branches': 'المخزون حسب الصنف (كل الفروع)',
            'search_items_stock_placeholder': 'ابحث باسم الصنف أو الكود...',
            'item_stock_inquiry': 'استعلام عن مخزون صنف',
            'item_stock_inquiry_placeholder': 'ابدأ بكتابة اسم الصنف أو الكود...',
            'no_stock_for_item': 'لا يوجد مخزون لهذا الصنف.',
            'table_h_qty': 'الكمية',
            'table_h_value': 'القيمة',
            'transaction_log': 'سجل الحركات',
            'all_types': 'كل الأنواع',
            'all_sections': 'كل الأقسام',
            'search_tx_placeholder': 'ابحث بالمرجع، كود/اسم الصنف...',
            'table_h_batch_ref': 'رقم الدفعة/المرجع',
            'view_print': 'عرض/طباعة',
            'users': 'المستخدمون',
            'add_new_user': 'إضافة مستخدم جديد',
            'table_h_fullname': 'الاسم الكامل',
            'table_h_role': 'الدور',
            'table_h_assigned_branch_section': 'الفرع/القسم المعين',
            'roles': 'الأدوار',
            'add_new_role': 'إضافة دور جديد',
            'table_h_rolename': 'اسم الدور',
            'system_activity_log': 'سجل نشاط النظام',
            'table_h_timestamp': 'الوقت',
            'table_h_user': 'المستخدم',
            'table_h_action': 'الإجراء',
            'table_h_description': 'الوصف',
            'select_items_modal_title': 'اختر الأصناف',
            'search_items_placeholder_modal': 'ابحث عن أصناف...',
            'confirm_selection': 'تأكيد الاختيار',
            'cancel': 'إلغاء',
            'select_invoices_modal_title': 'اختر الفواتير للدفع',
            'edit_modal_title': 'تعديل',
            'save_changes': 'حفظ التغييرات',
            'confirm_transfer_receipt_modal_title': 'تأكيد استلام التحويل',
            'reject': 'رفض',
            'confirm_receipt': 'تأكيد الاستلام',
            'item_history_modal_title': 'سجل الصنف',
            'price_history': 'سجل الأسعار',
            'movement_history': 'سجل الحركات',
            'close': 'إغلاق',
            'edit_po_modal_title': 'تعديل طلب الشراء',
            'approve_request_modal_title': 'الموافقة على طلب الصنف',
            'confirm_and_issue': 'تأكيد وصرف',
            'restore_from_backup_modal_title': 'الاستعادة من نسخة احتياطية',
            'restore_from_backup_desc': 'أنت على وشك استعادة البيانات من ملف النسخ الاحتياطي:',
            'restore_step1': '1. اختر أوراق البيانات التي تريد استعادتها.',
            'restore_step2': '2. قم بتأكيد هذا الإجراء الذي لا يمكن التراجع عنه.',
            'restore_danger_warning': 'خطر شديد:',
            'restore_danger_text': 'سيؤدي هذا إلى حذف البيانات الحالية نهائيًا في الأوراق المحددة واستبدالها بالبيانات من النسخة الاحتياطية. لا يمكن التراجع عن هذا الإجراء.',
            'restore_prompt': 'الرجاء كتابة "RESTORE" في المربع أدناه للمتابعة.',
            'confirm_and_restore': 'تأكيد واستعادة البيانات',
            'session_error_toast': 'خطأ في الجلسة. يرجى تسجيل الخروج والدخول مرة أخرى.',
            'action_failed_toast': 'فشل الإجراء: {errorMessage}',
            'data_refreshed_toast': 'تم تحديث البيانات!',
            'data_refresh_fail_toast': 'ไม่สามารถ تحديث البيانات. يرجى المحاولة مرة أخرى.',
            'backup_created_toast': 'تم إنشاء النسخة الاحتياطية: {fileName}',
            'backup_confirm_prompt': 'سيؤدي هذا إلى إنشاء نسخة احتياطية يدوية كاملة من جدول البيانات الحالي. هل تريد المتابعة؟',
            'auto_backup_updated_toast': 'تم تحديث إعدادات النسخ الاحتياطي التلقائي!',
            'auto_backup_failed_toast': 'فشل تحديث الإعدادات. يرجى المحاولة مرة أخرى.',
            'restore_select_sheet_toast': 'يجب عليك تحديد ورقة واحدة على الأقل لاستعادتها.',
            'restore_completed_toast': 'اكتملت الاستعادة بنجاح!',
            'restore_find_id_fail_toast': 'لم يتم العثور على معرف ملف النسخ الاحتياطي.',
            'tx_processed_toast': 'تمت معالجة {txType}!',
            'tx_processed_approval_toast': 'تمت معالجة {txType}! أُرسلت للموافقة.',
            'select_po_first_toast': 'يجب عليك تحديد طلب شراء لاستلام البضاعة.',
            'fill_required_fields_toast': 'يرجى ملء جميع الحقول المطلوبة وإضافة أصناف.',
            'status_approved': 'تمت الموافقة',
            'status_pending': 'قيد الموافقة',
            'status_rejected': 'مرفوض',
            'status_completed': 'مكتمل',
            'status_in_transit': 'قيد النقل',
            'status_cancelled': 'ملغى',
            'po': 'طلب شراء',
            'receive': 'استلام',
            'transfer': 'تحويل',
            'issue': 'صرف',
            'return': 'مرتجع',
            'stock_adjustment': 'تسوية مخزون',
            'history_for': 'سجل لـ: {itemName} ({itemCode})',
            'edit_item': 'تعديل صنف',
            'edit_supplier': 'تعديل مورد',
            'edit_branch': 'تعديل فرع',
            'edit_section': 'تعديل قسم',
            'edit_user': 'تعديل مستخدم',
            'add_new_user_title': 'إضافة مستخدم جديد',
            'edit_user_password_label': 'كلمة المرور / رمز الدخول (اتركه فارغًا للحفاظ على القديم)',
            'edit_user_password_label_new': 'كلمة المرور / رمز الدخول',
            'toggle_user_enable': 'تمكين المستخدم',
            'toggle_user_disable': 'تعطيل المستخدم',
            'toggle_user_enable_confirm': 'هل أنت متأكد من رغبتك في تمكين هذا المستخدم؟ سيتمكن من تسجيل الدخول مرة أخرى.',
            'toggle_user_disable_confirm': 'هل أنت متأكد من رغبتك في تعطيل هذا المستخدم؟ لن يتمكن من تسجيل الدخول.',
            'user_enabled_toast': 'تم تمكين المستخدم بنجاح!',
            'user_disabled_toast': 'تم تعطيل المستخدم بنجاح!',
            'edit_permissions_for': 'تعديل صلاحيات {roleName}',
            'delete_role': 'حذف الدور',
            'add_role_prompt': 'أدخل اسم الدور الجديد:',
            'update_success_toast': 'تم تحديث {type} بنجاح!',
            'add_success_toast': 'تمت إضافة {type} بنجاح!',
            'no_invoices_for_supplier': 'لا توجد فواتير لهذا المورد.',
            'no_unpaid_invoices': 'لا توجد فواتير غير مدفوعة لهذا المورد.',
            'invoice_modal_details': 'التاريخ: {date} | المبلغ المستحق: {balance} جنيه مصري',
            'no_items_selected_toast': 'لم يتم تحديد أصناف. انقر على "اختيار الأصناف".',
            'no_items_for_adjustment': 'لم يتم تحديد أصناف للتسوية.',
            'report_period_all_time': 'لكل الأوقات',
            'report_period_from_to': 'من {startDate} إلى {endDate}',
            'report_period_from': 'من {startDate}',
            'report_period_until': 'حتى {endDate}',
            'supplier_statement_title': 'كشف حساب مورد: {supplierName}',
            'date_generated': 'تاريخ الإنشاء:',
            'table_h_debit': 'مدين',
            'table_h_credit': 'دائن',
            'opening_balance_as_of': 'الرصيد الافتتاحي في {date}',
            'closing_balance': 'الرصيد الختامي:',
            'consumption_report_title': '{title}: {entityName}',
            'table_h_total_qty_consumed': 'إجمالي الكمية المستهلكة',
            'table_h_total_value_consumed': 'القيمة الإجمالية',
            'grand_total_value': 'القيمة الإجمالية الكلية:',
            'price_change_log': 'سجل تغيير الأسعار',
            'table_h_old_cost': 'التكلفة القديمة',
            'table_h_new_cost': 'التكلفة الجديدة',
            'table_h_change': 'التغيير',
            'table_h_source': 'المصدر',
            'table_h_updated_by': 'تم التحديث بواسطة',
            'no_price_history': 'لا يوجد سجل أسعار لهذا الصنف.',
            'no_movements_found': 'لم يتم العثور على حركات للمرشحات المحددة.',
            'table_h_qty_in': 'كمية واردة',
            'table_h_qty_out': 'كمية صادرة',
            'movement_details_receive': 'من: {supplier} إلى: {branch}',
            'movement_details_issue': 'من: {branch} إلى: {section}',
            'movement_details_transfer_out': 'مرسل من: {fromBranch} إلى: {toBranch}',
            'movement_details_transfer_in': 'مستلم في: {toBranch} من: {fromBranch}',
            'movement_details_return': 'مرتجع من: {branch} إلى: {supplier}',
            'movement_details_adjustment': 'جرد مخزون في: {branch}',
            'no_pending_financial_approval': 'لا توجد بنود تنتظر الموافقة المالية.',
            'approve': 'موافقة',
            'approve_confirm_prompt': 'هل أنت متأكد أنك تريد الموافقة على {type}؟',
            'reject_confirm_prompt': 'هل أنت متأكد أنك تريد رفض {type}؟ لا يمكن التراجع عن هذا الإجراء.',
            'approved_toast': 'تمت الموافقة على {type} بنجاح!',
            'rejected_toast': 'تم رفض {type} بنجاح!',
        }
    };

    const _t = (key, replacements = {}) => {
        let text = translations[state.currentLanguage]?.[key] || translations['en'][key] || key;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return text;
    };

    function applyTranslations() {
        const lang = state.currentLanguage;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

        document.querySelectorAll('[data-translate-key]').forEach(el => {
            const key = el.dataset.translateKey;
            el.textContent = _t(key);
        });
        
        document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
            const key = el.dataset.translatePlaceholder;
            el.placeholder = _t(key);
        });
    }

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
            
            const savedLang = localStorage.getItem('userLanguage') || 'en';
            state.currentLanguage = savedLang;
            document.getElementById('lang-switcher').value = savedLang;

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
            showToast(_t('session_error_toast'), 'error');
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
            const userMsg = _t('action_failed_toast', {errorMessage: error.message});
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
            const viewTitleKey = activeLink.querySelector('span').dataset.translateKey;
            document.getElementById('view-title').textContent = _t(viewTitleKey);
            document.getElementById('view-title').dataset.translateKey = viewTitleKey;
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

        document.getElementById('history-modal-title').textContent = _t('history_for', {itemName: item.name, itemCode: item.code});
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
        
        populateOptions(document.getElementById('history-filter-branch'), state.branches, _t('all_branches'), 'branchCode', 'branchName');
        const txTypes = ['receive', 'issue', 'transfer_out', 'transfer_in', 'return_out', 'adjustment_in', 'adjustment_out'];
        const txTypeOptions = txTypes.map(t => ({'type': t, 'name': t.replace(/_/g, ' ').toUpperCase()}));
        populateOptions(document.getElementById('history-filter-type'), txTypeOptions, _t('all_types'), 'type', 'name');

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
            priceHistoryContainer.innerHTML = `<p>${_t('no_price_history')}</p>`;
            movementHistoryContainer.querySelector('#movement-history-table-container').innerHTML = `<p>${_t('no_movements_found')}</p>`;
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
            showToast(_t('transfer_not_found_toast', 'error'));
            return;
        }
        const first = transferGroup[0];
        const fromBranch = findByKey(state.branches, 'branchCode', first.fromBranchCode)?.branchName || first.fromBranchCode;
        const toBranch = findByKey(state.branches, 'branchCode', first.toBranchCode)?.branchName || first.toBranchCode;

        const modalBody = document.getElementById('view-transfer-modal-body');
        const items = transferGroup.map(tx => {
            const item = findByKey(state.items, 'code', tx.itemCode) || { name: 'DELETED' };
            return { itemCode: tx.itemCode, itemName: item.name, quantity: tx.quantity };
        });

        let itemsHtml = items.map(item => `<tr><td>${item.itemCode}</td><td>${item.itemName}</td><td>${item.quantity}</td></tr>`).join('');

        modalBody.innerHTML = `
            <p><strong>${_t('from_branch')}:</strong> ${fromBranch}</p>
            <p><strong>${_t('to_branch')}:</strong> ${toBranch}</p>
            <p><strong>${_t('reference')}:</strong> ${first.ref || 'N/A'}</p>
            <hr>
            <h4>Items in Shipment</h4>
            <table><thead><tr><th>${_t('table_h_code')}</th><th>${_t('table_h_name')}</th><th>${_t('table_h_quantity')}</th></tr></thead><tbody>${itemsHtml}</tbody></table>`;
        
        const modal = document.getElementById('view-transfer-modal');
        modal.querySelector('.modal-footer').innerHTML = `
            <button class="secondary modal-cancel">${_t('cancel')}</button>
            <button id="btn-print-transfer-receipt" class="secondary">${_t('view_print')}</button>
            <button id="btn-reject-transfer" class="danger" data-batch-id="${batchId}">${_t('reject')}</button>
            <button id="btn-confirm-receive-transfer" class="primary" data-batch-id="${batchId}">${_t('confirm_receipt')}</button>
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
                editModalTitle.textContent = _t('edit_item');
                formHtml = `<div class="form-grid"><div class="form-group"><label>${_t('item_code')}</label><input type="text" value="${record.code}" readonly></div><div class="form-group"><label for="edit-item-barcode">${_t('barcode')}</label><input type="text" id="edit-item-barcode" name="barcode" value="${record.barcode || ''}"></div><div class="form-group"><label for="edit-item-name">${_t('item_name')}</label><input type="text" id="edit-item-name" name="name" value="${record.name}" required></div><div class="form-group"><label for="edit-item-unit">${_t('unit')}</label><input type="text" id="edit-item-unit" name="unit" value="${record.unit}" required></div><div class="form-group"><label for="edit-item-category">${_t('category')}</label><select id="edit-item-category" name="category" required><option value="Packing">${_t('packing')}</option><option value="Cleaning">${_t('cleaning')}</option></select></div><div class="form-group"><label for="edit-item-supplier">${_t('default_supplier')}</label><select id="edit-item-supplier" name="supplierCode"></select></div><div class="form-group span-full"><label for="edit-item-cost">${_t('default_cost')}</label><input type="number" id="edit-item-cost" name="cost" step="0.01" min="0" value="${record.cost}" required></div></div>`;
                editModalBody.innerHTML = formHtml;
                document.getElementById('edit-item-category').value = record.category;
                const supplierSelect = document.getElementById('edit-item-supplier');
                populateOptions(supplierSelect, state.suppliers, _t('select_supplier'), 'supplierCode', 'name');
                supplierSelect.value = record.supplierCode;
                break;
            case 'supplier':
                record = findByKey(state.suppliers, 'supplierCode', id);
                if (!record) return;
                editModalTitle.textContent = _t('edit_supplier');
                formHtml = `<div class="form-grid"><div class="form-group"><label>${_t('supplier_code')}</label><input type="text" value="${record.supplierCode}" readonly></div><div class="form-group"><label for="edit-supplier-name">${_t('supplier_name')}</label><input type="text" id="edit-supplier-name" name="name" value="${record.name}" required></div><div class="form-group"><label for="edit-supplier-contact">${_t('contact_info')}</label><input type="text" id="edit-supplier-contact" name="contact" value="${record.contact || ''}"></div></div>`;
                editModalBody.innerHTML = formHtml;
                break;
            case 'branch':
                record = findByKey(state.branches, 'branchCode', id);
                if (!record) return;
                editModalTitle.textContent = _t('edit_branch');
                formHtml = `<div class="form-grid"><div class="form-group"><label>${_t('branch_code')}</label><input type="text" value="${record.branchCode}" readonly></div><div class="form-group"><label for="edit-branch-name">${_t('branch_name')}</label><input type="text" id="edit-branch-name" name="branchName" value="${record.branchName}" required></div></div>`;
                editModalBody.innerHTML = formHtml;
                break;
            case 'section':
                record = findByKey(state.sections, 'sectionCode', id);
                if (!record) return;
                editModalTitle.textContent = _t('edit_section');
                formHtml = `<div class="form-grid"><div class="form-group"><label>${_t('section_code')}</label><input type="text" value="${record.sectionCode}" readonly></div><div class="form-group"><label for="edit-section-name">${_t('section_name')}</label><input type="text" id="edit-section-name" name="sectionName" value="${record.sectionName}" required></div></div>`;
                editModalBody.innerHTML = formHtml;
                break;
            case 'user':
                record = findByKey(state.allUsers, 'Username', id);
                if (!record && id !== null) return;
                editModalTitle.textContent = id ? _t('edit_user') : _t('add_new_user_title');
                const isUserDisabled = record ? (record.isDisabled === true || String(record.isDisabled).toUpperCase() === 'TRUE') : false;
                const currentUsername = record ? record.Username : '';
                const currentName = record ? record.Name : '';
                const currentRole = record ? record.RoleName : '';
                const currentBranch = record ? record.AssignedBranchCode : '';
                const currentSection = record ? record.AssignedSectionCode : '';

                const roleOptions = state.allRoles.map(r => `<option value="${r.RoleName}" ${r.RoleName === currentRole ? 'selected' : ''}>${r.RoleName}</option>`).join('');
                const branchOptions = state.branches.map(b => `<option value="${b.branchCode}" ${b.branchCode === currentBranch ? 'selected' : ''}>${b.branchName}</option>`).join('');
                const sectionOptions = state.sections.map(s => `<option value="${s.sectionCode}" ${s.sectionCode === currentSection ? 'selected' : ''}>${s.sectionName}</option>`).join('');
                const passwordLabel = id ? _t('edit_user_password_label') : _t('edit_user_password_label_new');
                
                formHtml = `<div class="form-grid"><div class="form-group"><label>${_t('username')}</label><input type="text" id="edit-user-username" name="Username" value="${currentUsername}" ${id ? 'readonly' : 'required'}></div><div class="form-group"><label for="edit-user-name">${_t('table_h_fullname')}</label><input type="text" id="edit-user-name" name="Name" value="${currentName}" required></div><div class="form-group"><label for="edit-user-role">${_t('table_h_role')}</label><select id="edit-user-role" name="RoleName" required>${roleOptions}</select></div><div class="form-group"><label for="edit-user-branch">${_t('branch')}</label><select id="edit-user-branch" name="AssignedBranchCode"><option value="">None</option>${branchOptions}</select></div><div class="form-group"><label for="edit-user-section">${_t('section')}</label><select id="edit-user-section" name="AssignedSectionCode"><option value="">None</option>${sectionOptions}</select></div><div class="form-group span-full"><label for="edit-user-password">${passwordLabel}</label><input type="password" id="edit-user-password" name="LoginCode" ${!id ? 'required' : ''}></div>`;
                if(id) {
                    const btnText = isUserDisabled ? _t('toggle_user_enable') : _t('toggle_user_disable');
                    const btnClass = isUserDisabled ? 'primary' : 'danger';
                    formHtml += `<div class="form-group span-full"><button type="button" id="btn-toggle-user-status" class="${btnClass}">${btnText}</button></div>`;
                }
                formHtml += `</div>`;
                editModalBody.innerHTML = formHtml;

                const toggleBtn = document.getElementById('btn-toggle-user-status');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', async () => {
                        const newStatus = !isUserDisabled;
                        const confirmationText = newStatus ? _t('toggle_user_disable_confirm') : _t('toggle_user_enable_confirm');
                        if (confirm(confirmationText)) {
                            const result = await postData('updateUser', { Username: id, updates: { isDisabled: newStatus } }, toggleBtn);
                            if (result) {
                                showToast(newStatus ? _t('user_disabled_toast') : _t('user_enabled_toast'), 'success');
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
                editModalTitle.textContent = _t('edit_permissions_for', {roleName: record.RoleName});

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

                formHtml += `<div class="form-group span-full" style="margin-top: 24px;"><button type="button" id="btn-delete-role" class="danger">${_t('delete_role')}</button></div>`;
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
            const toastMessage = id ? _t('update_success_toast', {type: _t(type)}) : _t('add_success_toast', {type: _t(type)});
            showToast(toastMessage, 'success');
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
            itemDiv.innerHTML = `<input type="checkbox" id="modal-item-${item.code}" data-code="${item.code}" ${isChecked ? 'checked' : ''}><label for="modal-item-${item.code}"><strong>${item.name}</strong><br><small style="color:var(--text-light-color)">${_t('table_h_code')}: ${item.code} | ${_t('category')}: ${item.category || 'N/A'}</small></label>`;
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
            modalInvoiceList.innerHTML = `<p>${_t('no_invoices_for_supplier')}</p>`;
            return;
        }
        const unpaidInvoices = Object.values(supplierInvoices).filter(inv => inv.status !== 'Paid');
        if (unpaidInvoices.length === 0) {
            modalInvoiceList.innerHTML = `<p>${_t('no_unpaid_invoices')}</p>`;
            return;
        }
        unpaidInvoices.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(invoice => {
            const isChecked = state.invoiceModalSelections.has(invoice.number);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'modal-item';
            const detailsText = _t('invoice_modal_details', { date: new Date(invoice.date).toLocaleDateString(), balance: invoice.balance.toFixed(2) });
            itemDiv.innerHTML = `<input type="checkbox" id="modal-invoice-${invoice.number}" data-number="${invoice.number}" ${isChecked ? 'checked' : ''}><label for="modal-invoice-${invoice.number}"><strong>${_t('table_h_invoice_no')}: ${invoice.number}</strong><br><small style="color:var(--text-light-color)">${detailsText}</small></label>`;
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
                const newItem = { itemCode: item.code, itemName: item.name, quantity: '', cost: item.cost }; // Default quantity is now empty
                if (modalContext === 'adjustment') {
                    newItem.physicalCount = '';
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
            buttonEl.innerHTML = `<div class="button-spinner"></div><span>${_t('signing_in')}</span>`;
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
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">${_t('no_items_found')}</td></tr>`;
            return;
        }
        const canEdit = userCan('editItem');
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${item.code}</td><td>${item.name}</td><td>${_t(item.category?.toLowerCase()) || item.category || 'N/A'}</td><td>${item.unit}</td><td>${(parseFloat(item.cost) || 0).toFixed(2)} EGP</td><td><div class="action-buttons"><button class="secondary small btn-edit" data-type="item" data-id="${item.code}" ${!canEdit ? 'disabled' : ''}>${_t('edit')}</button><button class="secondary small btn-history" data-type="item" data-id="${item.code}">${_t('history')}</button></div></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderSuppliersTable(data = state.suppliers) {
        const tbody = document.getElementById('table-suppliers').querySelector('tbody');
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${_t('no_suppliers_found')}</td></tr>`;
            return;
        }
        const financials = calculateSupplierFinancials();
        const canEdit = userCan('editSupplier');
        data.forEach(supplier => {
            const balance = financials[supplier.supplierCode]?.balance || 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${supplier.supplierCode || ''}</td><td>${supplier.name}</td><td>${supplier.contact}</td><td>${balance.toFixed(2)} EGP</td><td>${canEdit ? `<button class="secondary small btn-edit" data-type="supplier" data-id="${supplier.supplierCode}">${_t('edit')}</button>`: 'N/A'}</td>`;
            tbody.appendChild(tr);
        });
    }

    function renderBranchesTable(data = state.branches) {
        const tbody = document.getElementById('table-branches').querySelector('tbody');
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">${_t('no_branches_found')}</td></tr>`;
            return;
        }
        const canEdit = userCan('editBranch');
        data.forEach(branch => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${branch.branchCode || ''}</td><td>${branch.branchName}</td><td>${canEdit ? `<button class="secondary small btn-edit" data-type="branch" data-id="${branch.branchCode}">${_t('edit')}</button>`: 'N/A'}</td>`;
            tbody.appendChild(tr);
        });
    }

    function renderSectionsTable(data = state.sections) {
        const tbody = document.getElementById('table-sections').querySelector('tbody');
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">${_t('no_sections_found')}</td></tr>`;
            return;
        }
        const canEdit = userCan('editSection');
        data.forEach(section => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${section.sectionCode || ''}</td><td>${section.sectionName}</td><td>${canEdit ? `<button class="secondary small btn-edit" data-type="section" data-id="${section.sectionCode}">${_t('edit')}</button>`: 'N/A'}</td>`;
            tbody.appendChild(tr);
        });
    }

    const renderDynamicListTable = (tbodyId, list, columnsConfig, emptyMessage, totalizerFn) => {
        const tbody = document.getElementById(tbodyId).querySelector('tbody');
        tbody.innerHTML = '';
        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columnsConfig.length + 1}" style="text-align:center;">${_t(emptyMessage)}</td></tr>`;
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
                    case 'number_input': content = `<input type="number" class="table-input" value="${item[col.key] || ''}" min="${col.min || 0.01}" ${col.maxKey ? `max="${availableStock}"` : ''} step="${col.step || 0.01}" data-index="${index}" data-field="${col.key}">`; break;
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
    
    function renderReceiveListTable() { renderDynamicListTable('table-receive-list', state.currentReceiveList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'number_input', key: 'quantity' }, { type: 'cost_input', key: 'cost' }, { type: 'calculated', calculator: item => `${((parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0)).toFixed(2)} EGP` } ], 'no_items_selected_toast', updateReceiveGrandTotal); }
    function renderTransferListTable() { renderDynamicListTable('table-transfer-list', state.currentTransferList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'available_stock', branchSelectId: 'transfer-from-branch' }, { type: 'number_input', key: 'quantity', maxKey: true, branchSelectId: 'transfer-from-branch' } ], 'no_items_selected_toast', updateTransferGrandTotal); }
    function renderIssueListTable() { renderDynamicListTable('table-issue-list', state.currentIssueList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'available_stock', branchSelectId: 'issue-from-branch' }, { type: 'number_input', key: 'quantity', maxKey: true, branchSelectId: 'issue-from-branch' } ], 'no_items_selected_toast', updateIssueGrandTotal); }
    function renderPOListTable() { renderDynamicListTable('table-po-list', state.currentPOList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'number_input', key: 'quantity' }, { type: 'cost_input', key: 'cost' }, { type: 'calculated', calculator: item => `${((parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0)).toFixed(2)} EGP` } ], 'no_items_selected_toast', updatePOGrandTotal); }
    function renderPOEditListTable() { renderDynamicListTable('table-edit-po-list', state.currentEditingPOList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'number_input', key: 'quantity' }, { type: 'cost_input', key: 'cost' }, { type: 'calculated', calculator: item => `${((parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0)).toFixed(2)} EGP` } ], 'no_items_selected_toast', updatePOEditGrandTotal); }
    function renderReturnListTable() { renderDynamicListTable('table-return-list', state.currentReturnList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'available_stock', branchSelectId: 'return-branch' }, { type: 'number_input', key: 'quantity', maxKey: true, branchSelectId: 'return-branch' }, { type: 'cost_input', key: 'cost' } ], 'no_items_selected_toast', updateReturnGrandTotal); }
    function renderRequestListTable() { renderDynamicListTable('table-request-list', state.currentRequestList, [ { type: 'text', key: 'itemCode' }, { type: 'text', key: 'itemName' }, { type: 'number_input', key: 'quantity' } ], 'no_items_selected_toast', null); }

    function renderAdjustmentListTable() {
        const tbody = document.getElementById('table-adjustment-list').querySelector('tbody');
        tbody.innerHTML = '';
        if (!state.currentAdjustmentList || state.currentAdjustmentList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">${_t('no_items_for_adjustment')}</td></tr>`;
            return;
        }
        const stock = calculateStockLevels();
        const branchCode = document.getElementById('adjustment-branch').value;

        state.currentAdjustmentList.forEach((item, index) => {
            const systemQty = (branchCode && stock[branchCode]?.[item.itemCode]?.quantity) || 0;
            const physicalCount = typeof item.physicalCount !== 'undefined' ? item.physicalCount : '';
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
        let tableHTML = `<table id="table-stock-levels-by-item"><thead><tr><th>${_t('table_h_code')}</th><th>${_t('table_h_name')}</th>`;
        branchesToDisplay.forEach(b => { tableHTML += `<th>${b.branchName}</th>` });
        tableHTML += `<th>${_t('table_h_total')}</th></tr></thead><tbody>`;
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
            html += `<h4>${item.name} (${item.code})</h4><table><thead><tr><th>${_t('branch')}</th><th>${_t('table_h_qty')}</th><th>${_t('table_h_value')}</th></tr></thead><tbody>`;
            let found = false;
            let totalQty = 0;
            let totalValue = 0;
            branchesToDisplay.forEach(branch => {
                const itemStock = stockByBranch[branch.branchCode]?.[item.code];
                if (itemStock && itemStock.quantity > 0) {
                    const value = itemStock.quantity * itemStock.avgCost;
                    html += `<tr><td>${branch.branchName} (${branch.branchCode || ''})</td><td>${itemStock.quantity.toFixed(2)}</td><td>${value.toFixed(2)} EGP</td></tr>`;
                    totalQty += itemStock.quantity;
                    totalValue += value;
                    found = true;
                }
            });
            if (!found) {
                html += `<tr><td colspan="3">${_t('no_stock_for_item')}</td></tr>`;
            } else {
                html += `<tr style="font-weight:bold; background-color: var(--bg-color);"><td>${_t('table_h_total')}</td><td>${totalQty.toFixed(2)}</td><td>${totalValue.toFixed(2)} EGP</td></tr>`
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
            resultsContainer.innerHTML = `<p>No financial data found for this supplier.</p>`;
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
            tableBodyHtml += `<tr style="background-color: var(--bg-color);"><td colspan="3"><strong>${_t('opening_balance_as_of', {date: sDate.toLocaleDateString()})}</strong></td><td>-</td><td>-</td><td><strong>${openingBalance.toFixed(2)} EGP</strong></td></tr>`;
        }
        filteredEvents.forEach(event => {
            balance += (event.debit || 0) - (event.credit || 0);
            tableBodyHtml += `<tr><td>${new Date(event.date).toLocaleDateString()}</td><td>${event.type}</td><td>${event.ref}</td><td>${event.debit > 0 ? event.debit.toFixed(2) : '-'}</td><td>${event.credit > 0 ? event.credit.toFixed(2) : '-'}</td><td>${balance.toFixed(2)} EGP</td></tr>`;
        });
        let dateHeader = _t('report_period_all_time');
        if (sDate && eDate) {
            dateHeader = _t('report_period_from_to', {startDate: sDate.toLocaleDateString(), endDate: eDate.toLocaleDateString()});
        } else if (sDate) {
            dateHeader = _t('report_period_from', {startDate: sDate.toLocaleDateString()});
        } else if (eDate) {
            dateHeader = _t('report_period_until', {endDate: eDate.toLocaleDateString()});
        }
        resultsContainer.innerHTML = `<div class="printable-document"><div class="printable-header"><div><h2>${_t('supplier_statement_title', {supplierName: supplier.name})}</h2><p style="margin:0; color: var(--text-light-color);">${_t('report_period_all_time')} ${dateHeader}</p></div><button class="secondary small no-print" onclick="printReport('supplier-statement-results')">${_t('print_list')}</button></div><p><strong>${_t('date_generated')}</strong> ${new Date().toLocaleString()}</p><div class="report-area"><table id="table-supplier-statement-report"><thead><tr><th>${_t('table_h_date')}</th><th>${_t('table_h_type')}</th><th>${_t('reference')}</th><th>${_t('table_h_debit')}</th><th>${_t('table_h_credit')}</th><th>${_t('table_h_balance')}</th></tr></thead><tbody>${tableBodyHtml}</tbody><tfoot><tr style="font-weight:bold; background-color: var(--bg-color);"><td colspan="5" style="text-align:right;">${_t('closing_balance')}</td><td>${balance.toFixed(2)} EGP</td></tr></tfoot></table></div></div>`;
        resultsContainer.style.display = 'block';
        exportBtn.disabled = false;
    }

    function renderUnifiedConsumptionReport() {
        const resultsContainer = document.getElementById('consumption-report-results');
        const exportBtn = document.getElementById('btn-export-consumption-report');
        
        const selectedBranches = Array.from(document.getElementById('consumption-branch-filter').selectedOptions).map(o => o.value);
        const selectedSections = Array.from(document.getElementById('consumption-section-filter').selectedOptions).map(o => o.value);
        const selectedItems = Array.from(document.getElementById('consumption-item-filter').selectedOptions).map(o => o.value);
        const startDate = document.getElementById('consumption-start-date').value;
        const endDate = document.getElementById('consumption-end-date').value;

        let filteredTx = (state.transactions || []).filter(t => t.type === 'issue');

        const sDate = startDate ? new Date(startDate) : null; if(sDate) sDate.setHours(0,0,0,0);
        const eDate = endDate ? new Date(endDate) : null; if(eDate) eDate.setHours(23,59,59,999);

        if(selectedBranches.length > 0) filteredTx = filteredTx.filter(t => selectedBranches.includes(t.fromBranchCode));
        if(selectedSections.length > 0) filteredTx = filteredTx.filter(t => selectedSections.includes(t.sectionCode));
        if(selectedItems.length > 0) filteredTx = filteredTx.filter(t => selectedItems.includes(t.itemCode));
        if(sDate) filteredTx = filteredTx.filter(t => new Date(t.date) >= sDate);
        if(eDate) filteredTx = filteredTx.filter(t => new Date(t.date) <= eDate);

        const historicalCosts = calculateHistoricalCosts();
        const reportData = {};
        let grandTotalValue = 0;

        filteredTx.forEach(t => {
            const branch = findByKey(state.branches, 'branchCode', t.fromBranchCode);
            const section = findByKey(state.sections, 'sectionCode', t.sectionCode);
            const item = findByKey(state.items, 'code', t.itemCode);
            if (!branch || !section || !item) return;
            
            const cost = historicalCosts[`${t.batchId}-${t.itemCode}`] || item.cost;
            const value = (parseFloat(t.quantity) || 0) * (parseFloat(cost) || 0);
            grandTotalValue += value;

            if (!reportData[branch.branchName]) reportData[branch.branchName] = { totalValue: 0, sections: {} };
            if (!reportData[branch.branchName].sections[section.sectionName]) reportData[branch.branchName].sections[section.sectionName] = { totalValue: 0, items: {} };
            if (!reportData[branch.branchName].sections[section.sectionName].items[item.name]) reportData[branch.branchName].sections[section.sectionName].items[item.name] = { totalValue: 0, totalQty: 0, item: item };

            reportData[branch.branchName].totalValue += value;
            reportData[branch.branchName].sections[section.sectionName].totalValue += value;
            reportData[branch.branchName].sections[section.sectionName].items[item.name].totalValue += value;
            reportData[branch.branchName].sections[section.sectionName].items[item.name].totalQty += parseFloat(t.quantity) || 0;
        });

        let tableHtml = `<table id="table-consumption-report"><thead><tr><th>Name</th><th style="text-align:right;">Total Qty</th><th style="text-align:right;">Total Value</th><th style="text-align:right;">% of Parent</th><th style="text-align:right;">% of Total</th></tr></thead><tbody>`;
        for (const branchName in reportData) {
            const branchData = reportData[branchName];
            tableHtml += `<tr class="consumption-group-branch"><td>${branchName}</td><td colspan="1"></td><td style="text-align:right;">${branchData.totalValue.toFixed(2)}</td><td style="text-align:right;">-</td><td style="text-align:right;">${(branchData.totalValue / grandTotalValue * 100).toFixed(2)}%</td></tr>`;
            for(const sectionName in branchData.sections) {
                const sectionData = branchData.sections[sectionName];
                tableHtml += `<tr class="consumption-group-section"><td>${sectionName}</td><td colspan="1"></td><td style="text-align:right;">${sectionData.totalValue.toFixed(2)}</td><td style="text-align:right;">${(sectionData.totalValue / branchData.totalValue * 100).toFixed(2)}%</td><td style="text-align:right;">${(sectionData.totalValue / grandTotalValue * 100).toFixed(2)}%</td></tr>`;
                 for(const itemName in sectionData.items) {
                    const itemData = sectionData.items[itemName];
                    tableHtml += `<tr class="consumption-item-row"><td>${itemName} (${itemData.item.code})</td><td style="text-align:right;">${itemData.totalQty.toFixed(2)} ${itemData.item.unit}</td><td style="text-align:right;">${itemData.totalValue.toFixed(2)}</td><td style="text-align:right;">${(itemData.totalValue / sectionData.totalValue * 100).toFixed(2)}%</td><td style="text-align:right;">${(itemData.totalValue / grandTotalValue * 100).toFixed(2)}%</td></tr>`;
                 }
            }
        }
        tableHtml += `</tbody><tfoot><tr style="font-weight:bold; background-color:var(--bg-color);"><td colspan="2" style="text-align:right;">Grand Total</td><td style="text-align:right;">${grandTotalValue.toFixed(2)} EGP</td><td colspan="2"></td></tr></tfoot></table>`;

        resultsContainer.innerHTML = `<div class="printable-document">${tableHtml}</div>`;
        resultsContainer.style.display = 'block';
        exportBtn.disabled = false;
    }
    
    function renderPriceHistory(priceHistory) {
        const container = document.getElementById('subview-price-history');
        let html = `<h4>${_t('price_change_log')}</h4><table id="table-price-history"><thead><tr><th>${_t('table_h_date')}</th><th>${_t('table_h_old_cost')}</th><th>${_t('table_h_new_cost')}</th><th>${_t('table_h_change')}</th><th>${_t('table_h_source')}</th><th>${_t('table_h_updated_by')}</th></tr></thead><tbody>`;
        if (!priceHistory || priceHistory.length === 0) {
            html += `<tr><td colspan="6" style="text-align:center;">${_t('no_price_history')}</td></tr>`;
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
        
        let html = `<table id="table-movement-history"><thead><tr><th>${_t('table_h_date')}</th><th>${_t('table_h_type')}</th><th>${_t('reference')}</th><th>${_t('table_h_details')}</th><th style="text-align:right;">${_t('table_h_qty_in')}</th><th style="text-align:right;">${_t('table_h_qty_out')}</th></tr></thead><tbody>`;
        if (filteredHistory.length === 0) {
            html += `<tr><td colspan="6" style="text-align:center;">${_t('no_movements_found')}</td></tr>`;
        } else {
            filteredHistory.forEach(t => {
                let typeText = t.type.replace('_', ' ').toUpperCase();
                let details = '', qtyIn = '-', qtyOut = '-';
                const quantity = parseFloat(t.quantity) || 0;

                switch (t.type) {
                    case 'receive': 
                        details = _t('movement_details_receive', {supplier: findByKey(state.suppliers, 'supplierCode', t.supplierCode)?.name || t.supplierCode, branch: findByKey(state.branches, 'branchCode', t.branchCode)?.branchName || t.branchCode});
                        qtyIn = quantity.toFixed(2);
                        break;
                    case 'issue':
                        details = _t('movement_details_issue', {branch: findByKey(state.branches, 'branchCode', t.fromBranchCode)?.branchName || t.fromBranchCode, section: findByKey(state.sections, 'sectionCode', t.sectionCode)?.sectionName || t.sectionCode});
                        qtyOut = quantity.toFixed(2);
                        break;
                    case 'transfer_out':
                        details = _t('movement_details_transfer_out', {fromBranch: findByKey(state.branches, 'branchCode', t.fromBranchCode)?.branchName, toBranch: findByKey(state.branches, 'branchCode', t.toBranchCode)?.branchName});
                        qtyOut = quantity.toFixed(2);
                        break;
                    case 'transfer_in':
                        details = _t('movement_details_transfer_in', {toBranch: findByKey(state.branches, 'branchCode', t.toBranchCode)?.branchName, fromBranch: findByKey(state.branches, 'branchCode', t.fromBranchCode)?.branchName});
                        qtyIn = quantity.toFixed(2);
                        break;
                    case 'return_out':
                        details = _t('movement_details_return', {branch: findByKey(state.branches, 'branchCode', t.fromBranchCode)?.branchName, supplier: findByKey(state.suppliers, 'supplierCode', t.supplierCode)?.name});
                        qtyOut = quantity.toFixed(2);
                        break;
                    case 'adjustment_in':
                        details = _t('movement_details_adjustment', {branch: findByKey(state.branches, 'branchCode', t.fromBranchCode)?.branchName});
                        qtyIn = quantity.toFixed(2);
                        break;
                    case 'adjustment_out':
                        details = _t('movement_details_adjustment', {branch: findByKey(state.branches, 'branchCode', t.fromBranchCode)?.branchName});
                        qtyOut = quantity.toFixed(2);
                        break;
                }
                html += `<tr><td>${new Date(t.date).toLocaleString()}</td><td>${typeText}</td><td>${t.invoiceNumber || t.ref || t.batchId}</td><td>${details}</td><td style="text-align:right;">${qtyIn}</td><td style="text-align:right;">${qtyOut}</td></tr>`;
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

            let actionsHtml = `<button class="secondary small btn-view-tx" data-batch-id="${group.batchId}" data-type="${first.type}">${_t('view_print')}</button>`;
            if(canEditInvoice){
                actionsHtml += `<button class="secondary small btn-edit-invoice" data-batch-id="${group.batchId}">${_t('edit')}</button>`;
            }

            switch(first.type) {
                case 'receive':
                    details = `${_t('receive')} ${group.transactions.length} ${_t('items')} from <strong>${findByKey(state.suppliers, 'supplierCode', first.supplierCode)?.name || 'N/A'}</strong> to <strong>${findByKey(state.branches, 'branchCode', first.branchCode)?.branchName || 'N/A'}</strong>`;
                    refNum = first.invoiceNumber;
                    statusTag = first.isApproved === true || String(first.isApproved).toUpperCase() === 'TRUE' ? `<span class="status-tag status-approved">${_t('status_approved')}</span>` : `<span class="status-tag status-pendingapproval">${_t('status_pending')}</span>`;
                    break;
                case 'return_out':
                    details = `${_t('return')} ${group.transactions.length} ${_t('items')} from <strong>${findByKey(state.branches, 'branchCode', first.fromBranchCode)?.branchName || 'N/A'}</strong> to <strong>${findByKey(state.suppliers, 'supplierCode', first.supplierCode)?.name || 'N/A'}</strong>`;
                    typeDisplay = _t('return_to_supplier');
                    break;
                case 'issue':
                    details = `${_t('issue')} ${group.transactions.length} ${_t('items')} from <strong>${findByKey(state.branches, 'branchCode', first.fromBranchCode)?.branchName || 'N/A'}</strong> to <strong>${findByKey(state.sections, 'sectionCode', first.sectionCode)?.sectionName || 'N/A'}</strong>`;
                    break;
                case 'transfer_out':
                case 'transfer_in':
                     details = `${_t('transfer')} ${group.transactions.length} ${_t('items')} from <strong>${findByKey(state.branches, 'branchCode', first.fromBranchCode)?.branchName || 'N/A'}</strong> to <strong>${findByKey(state.branches, 'branchCode', first.toBranchCode)?.branchName || 'N/A'}</strong>`;
                     typeDisplay = _t('transfer');
                     statusTag = `<span class="status-tag status-${(first.Status || '').toLowerCase().replace(/ /g,'')}">${_t('status_' + (first.Status || '').toLowerCase().replace(/ /g,''))}</span>`;
                     break;
                case 'po':
                    typeDisplay = _t('po');
                    details = `${_t('create_po')} for <strong>${findByKey(state.suppliers, 'supplierCode', first.supplierCode)?.name || 'N/A'}</strong>`;
                    statusTag = `<span class="status-tag status-${(first.Status || 'pending').toLowerCase().replace(/ /g,'')}">${_t('status_' + (first.Status || 'pending').toLowerCase().replace(/ /g,''))}</span>`;
                    break;
                case 'adjustment_in':
                case 'adjustment_out':
                     typeDisplay = _t('stock_adjustment');
                     details = `${_t('adjustments')} ${group.transactions.length} ${_t('items')} at <strong>${findByKey(state.branches, 'branchCode', first.fromBranchCode)?.branchName || 'N/A'}</strong>`;
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
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No activity logged.</td></tr>`;
            return;
        }
        state.activityLog.slice().reverse().forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date(log.Timestamp).toLocaleString()}</td><td>${log.User || 'N/A'}</td><td>${log.Action}</td><td>${log.Description}</td>`;
            tbody.appendChild(tr);
        });
    }
    
    const generateReceiveDocument = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; const branch = findByKey(state.branches, 'branchCode', data.branchCode) || { branchName: 'DELETED' }; let itemsHtml = '', totalValue = 0; data.items.forEach(item => { const itemTotal = item.quantity * item.cost; totalValue += itemTotal; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName}</td><td>${item.quantity.toFixed(2)}</td><td>${item.cost.toFixed(2)} EGP</td><td>${itemTotal.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card" dir="${state.currentLanguage === 'ar' ? 'rtl' : 'ltr'}"><h2>Goods Received Note</h2><p><strong>GRN No:</strong> ${data.batchId}</p><p><strong>${_t('table_h_invoice_no')}:</strong> ${data.invoiceNumber}</p><p><strong>${_t('table_h_date')}:</strong> ${new Date(data.date).toLocaleString()}</p><p><strong>${_t('supplier')}:</strong> ${supplier.name} (${supplier.supplierCode || ''})</p><p><strong>${_t('receive_stock')} at:</strong> ${branch.branchName} (${branch.branchCode || ''})</p><hr><h3>${_t('items_to_be_received')}</h3><table><thead><tr><th>${_t('table_h_code')}</th><th>${_t('item')}</th><th>${_t('table_h_qty')}</th><th>${_t('table_h_cost_per_unit')}</th><th>${_t('table_h_total')}</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold;">${_t('total_value')}</td><td style="font-weight:bold;">${totalValue.toFixed(2)} EGP</td></tr></tfoot></table><hr><p><strong>${_t('notes_optional')}:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Signature:</strong> _________________________</p></div>`; printContent(content); };
    const generateTransferDocument = (data) => { const fromBranch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { branchName: 'DELETED' }; const toBranch = findByKey(state.branches, 'branchCode', data.toBranchCode) || { branchName: 'DELETED' }; let itemsHtml = ''; data.items.forEach(item => { const fullItem = findByKey(state.items, 'code', item.itemCode) || { code: 'N/A', name: 'DELETED', unit: 'N/A' }; itemsHtml += `<tr><td>${fullItem.code || item.itemCode}</td><td>${item.itemName || fullItem.name}</td><td>${parseFloat(item.quantity).toFixed(2)}</td><td>${fullItem.unit}</td></tr>`; }); const content = `<div class="printable-document card" dir="${state.currentLanguage === 'ar' ? 'rtl' : 'ltr'}"><h2>${_t('internal_transfer')} Order</h2><p><strong>Order ID:</strong> ${data.batchId}</p><p><strong>${_t('reference')}:</strong> ${data.ref}</p><p><strong>${_t('table_h_date')}:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>${_t('from_branch')}:</strong> ${fromBranch.branchName} (${fromBranch.branchCode || ''})</p><p><strong>${_t('to_branch')}:</strong> ${toBranch.branchName} (${toBranch.branchCode || ''})</p><hr><h3>${_t('items_to_be_transferred')}</h3><table><thead><tr><th>${_t('table_h_code')}</th><th>${_t('item')}</th><th>${_t('table_h_qty')}</th><th>${_t('table_h_unit')}</th></tr></thead><tbody>${itemsHtml}</tbody></table><hr><p><strong>${_t('notes_optional')}:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Sender:</strong> _________________</p><p><strong>Receiver:</strong> _________________</p></div>`; printContent(content); };
    const generateIssueDocument = (data) => { const fromBranch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { branchName: 'DELETED' }; const toSection = findByKey(state.sections, 'sectionCode', data.sectionCode) || { sectionName: 'DELETED' }; let itemsHtml = ''; data.items.forEach(item => { const fullItem = findByKey(state.items, 'code', item.itemCode) || { name: 'DELETED', unit: 'N/A' }; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName || fullItem.name}</td><td>${item.quantity.toFixed(2)}</td><td>${fullItem.unit}</td></tr>`; }); const content = `<div class="printable-document card" dir="${state.currentLanguage === 'ar' ? 'rtl' : 'ltr'}"><h2>${_t('issue_stock')} Note</h2><p><strong>${_t('issue_ref_no')}:</strong> ${data.ref}</p><p><strong>Batch ID:</strong> ${data.batchId}</p><p><strong>${_t('table_h_date')}:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>${_t('from_branch')}:</strong> ${fromBranch.branchName} (${fromBranch.branchCode || ''})</p><p><strong>${_t('to_section')}:</strong> ${toSection.sectionName} (${toSection.sectionCode || ''})</p><hr><h3>${_t('items_to_be_issued')}</h3><table><thead><tr><th>${_t('table_h_code')}</th><th>${_t('item')}</th><th>${_t('table_h_qty')}</th><th>${_t('table_h_unit')}</th></tr></thead><tbody>${itemsHtml}</tbody></table><hr><p><strong>${_t('notes_optional')}:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Issued By:</strong> _________________</p><p><strong>Received By:</strong> _________________</p></div>`; printContent(content); };
    const generatePaymentVoucher = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; let invoicesHtml = ''; data.payments.forEach(p => { invoicesHtml += `<tr><td>${p.invoiceNumber}</td><td>${p.amount.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card" dir="${state.currentLanguage === 'ar' ? 'rtl' : 'ltr'}"><h2>Payment Voucher</h2><p><strong>Voucher ID:</strong> ${data.payments[0].paymentId}</p><p><strong>${_t('table_h_date')}:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>Paid To:</strong> ${supplier.name} (${supplier.supplierCode || ''})</p><p><strong>${_t('table_h_amount')}:</strong> ${data.totalAmount.toFixed(2)} EGP</p><p><strong>Method:</strong> ${data.method}</p><hr><h3>Payment Allocation</h3><table><thead><tr><th>${_t('table_h_invoice_no')}</th><th>${_t('table_h_amount_to_pay')}</th></tr></thead><tbody>${invoicesHtml}</tbody></table><br><p><strong>Signature:</strong> _________________</p></div>`; printContent(content); };
    const generatePODocument = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; let itemsHtml = '', totalValue = 0; data.items.forEach(item => { const itemDetails = findByKey(state.items, 'code', item.itemCode) || {name: "N/A"}; const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); totalValue += itemTotal; itemsHtml += `<tr><td>${item.itemCode}</td><td>${itemDetails.name}</td><td>${(parseFloat(item.quantity) || 0).toFixed(2)}</td><td>${(parseFloat(item.cost) || 0).toFixed(2)} EGP</td><td>${itemTotal.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card" dir="${state.currentLanguage === 'ar' ? 'rtl' : 'ltr'}"><h2>${_t('po')}</h2><p><strong>${_t('table_h_po_no')}:</strong> ${data.poId || data.batchId}</p><p><strong>${_t('table_h_date')}:</strong> ${new Date(data.date).toLocaleString()}</p><p><strong>${_t('supplier')}:</strong> ${supplier.name} (${supplier.supplierCode || ''})</p><hr><h3>${_t('items_to_order')}</h3><table><thead><tr><th>${_t('table_h_code')}</th><th>${_t('item')}</th><th>${_t('table_h_qty')}</th><th>${_t('table_h_cost_per_unit')}</th><th>${_t('table_h_total')}</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold;">${_t('total_value')}</td><td style="font-weight:bold;">${totalValue.toFixed(2)} EGP</td></tr></tfoot></table><hr><p><strong>${_t('notes_optional')}:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Authorized By:</strong> ${data.createdBy || state.currentUser.Name}</p></div>`; printContent(content); };
    const generateReturnDocument = (data) => { const supplier = findByKey(state.suppliers, 'supplierCode', data.supplierCode) || { name: 'DELETED' }; const branch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { branchName: 'DELETED' }; let itemsHtml = '', totalValue = 0; data.items.forEach(item => { const itemTotal = item.quantity * item.cost; totalValue += itemTotal; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName}</td><td>${item.quantity.toFixed(2)}</td><td>${item.cost.toFixed(2)} EGP</td><td>${itemTotal.toFixed(2)} EGP</td></tr>`; }); const content = `<div class="printable-document card" dir="${state.currentLanguage === 'ar' ? 'rtl' : 'ltr'}"><h2>${_t('return_to_supplier')} Note</h2><p><strong>${_t('credit_note_ref')}:</strong> ${data.ref}</p><p><strong>${_t('table_h_date')}:</strong> ${new Date(data.date).toLocaleString()}</p><p><strong>Returned To:</strong> ${supplier.name}</p><p><strong>Returned From:</strong> ${branch.branchName}</p><hr><h3>${_t('items_to_return')}</h3><table><thead><tr><th>${_t('table_h_code')}</th><th>${_t('item')}</th><th>${_t('table_h_qty')}</th><th>${_t('table_h_cost_per_unit')}</th><th>${_t('table_h_total')}</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold;">${_t('total_value')}</td><td style="font-weight:bold;">${totalValue.toFixed(2)} EGP</td></tr></tfoot></table><hr><p><strong>Reason:</strong> ${data.notes || 'N/A'}</p></div>`; printContent(content); };
    const generateRequestIssueDocument = (data) => { const fromBranch = findByKey(state.branches, 'branchCode', data.fromBranchCode) || { branchName: 'DELETED' }; const toSection = findByKey(state.sections, 'sectionCode', data.sectionCode) || { sectionName: 'DELETED' }; let itemsHtml = ''; data.items.forEach(item => { const fullItem = findByKey(state.items, 'code', item.itemCode) || { name: 'DELETED', unit: 'N/A' }; itemsHtml += `<tr><td>${item.itemCode}</td><td>${item.itemName || fullItem.name}</td><td>${(item.quantity || 0).toFixed(2)}</td><td>${fullItem.unit}</td></tr>`; }); const content = `<div class="printable-document card" dir="${state.currentLanguage === 'ar' ? 'rtl' : 'ltr'}"><h2>DRAFT ${_t('issue_stock')} Note (from Request)</h2><p><strong>${_t('table_h_req_id')}:</strong> ${data.ref}</p><p><strong>${_t('table_h_date')}:</strong> ${new Date(data.date).toLocaleString()}</p><hr><p><strong>${_t('from_branch')}:</strong> ${fromBranch.branchName} (${fromBranch.branchCode || ''})</p><p><strong>${_t('to_section')}:</strong> ${toSection.sectionName} (${toSection.sectionCode || ''})</p><hr><h3>${_t('items_to_be_issued')}</h3><table><thead><tr><th>${_t('table_h_code')}</th><th>${_t('item')}</th><th>${_t('table_h_qty')}</th><th>${_t('table_h_unit')}</th></tr></thead><tbody>${itemsHtml}</tbody></table><hr><p><strong>${_t('notes_optional')}:</strong> ${data.notes || 'N/A'}</p><br><p><strong>Issued By:</strong> _________________</p><p><strong>Received By:</strong> _________________</p></div>`; printContent(content); };

// PART 4 OF 4: CALCULATION ENGINES, EVENT LISTENERS & INITIALIZATION
    function updateReceiveGrandTotal() { let grandTotal = 0; (state.currentReceiveList || []).forEach(item => { grandTotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); }); document.getElementById('receive-grand-total').textContent = `${grandTotal.toFixed(2)} EGP`; }
    function updateTransferGrandTotal() { let grandTotalQty = 0; (state.currentTransferList || []).forEach(item => { grandTotalQty += (parseFloat(item.quantity) || 0); }); document.getElementById('transfer-grand-total').textContent = grandTotalQty.toFixed(2); }
    function updateIssueGrandTotal() { let grandTotalQty = 0; (state.currentIssueList || []).forEach(item => { grandTotalQty += (parseFloat(item.quantity) || 0); }); document.getElementById('issue-grand-total').textContent = grandTotalQty.toFixed(2); }
    function updatePOGrandTotal() { let grandTotal = 0; (state.currentPOList || []).forEach(item => { grandTotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); }); document.getElementById('po-grand-total').textContent = `${grandTotal.toFixed(2)} EGP`; }
    function updatePOEditGrandTotal() { let grandTotal = 0; (state.currentEditingPOList || []).forEach(item => { grandTotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); }); document.getElementById('edit-po-grand-total').textContent = `${grandTotal.toFixed(2)} EGP`; }
    function updateReturnGrandTotal() { let grandTotal = 0; (state.currentReturnList || []).forEach(item => { grandTotal += (parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0); }); document.getElementById('return-grand-total').textContent = `${grandTotal.toFixed(2)} EGP`; }

    async function loadAndRenderBackups() {
        const container = document.getElementById('backup-list-container');
        container.innerHTML = `<table><tbody><tr><td><div class="spinner" style="width:30px;height:30px;border-width:3px;"></div></td><td>${_t('loading_backups')}</td></tr></tbody></table>`;
        const result = await postData('listBackups', {}, null);
        if (result && result.data) {
            state.backups = result.data;
            if (state.backups.length === 0) {
                container.innerHTML = `<p>${_t('no_backups_found')}</p>`;
                return;
            }
            let tableHtml = `<table id="table-backups"><thead><tr><th>${_t('backup_name')}</th><th>${_t('date_created')}</th><th>${_t('actions')}</th></tr></thead><tbody>`;
            state.backups.forEach(backup => {
                tableHtml += `
                    <tr>
                        <td>${backup.name}</td>
                        <td>${new Date(backup.dateCreated).toLocaleString()}</td>
                        <td>
                            <div class="action-buttons">
                                <a href="${backup.url}" target="_blank" rel="noopener noreferrer" class="secondary small" style="text-decoration: none;">${_t('open')}</a>
                                <button class="danger small btn-restore" data-url="${backup.url}">${_t('restore')}</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableHtml += '</tbody></table>';
            container.innerHTML = tableHtml;
        } else {
            container.innerHTML = `<p>Could not load backup list. Please check permissions or try again.</p>`;
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
            showToast(_t('auto_backup_updated_toast'), 'success');
            statusEl.textContent = isEnabled
                ? `Automatic backups are now enabled (${frequency}).`
                : 'Automatic backups have been disabled.';
        } else {
            toggle.checked = !isEnabled;
            frequencyContainer.style.display = toggle.checked ? 'block' : 'none';
            statusEl.textContent = _t('auto_backup_failed_toast');
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
            showToast(_t('restore_select_sheet_toast'), 'error');
            return;
        }
    
        const payload = {
            backupFileId: backupFileId,
            sheetsToRestore: selectedSheets
        };
    
        const result = await postData('restoreFromBackup', payload, btn);
    
        if (result) {
            showToast(result.data.message || _t('restore_completed_toast'), 'success');
            closeModal();
            await reloadDataAndRefreshUI();
        }
    }

    async function handleTransactionSubmit(payload, buttonEl) {
        const action = payload.type === 'po' ? 'addPurchaseOrder' : 'addTransactionBatch';
        const result = await postData(action, payload, buttonEl);
        if (result) {
            const typeKey = payload.type.replace(/_/g,'');
            let message = _t('tx_processed_toast', { txType: _t(typeKey) });
            if (payload.type === 'receive' || payload.type === 'po') {
                 message = _t('tx_processed_approval_toast', { txType: _t(typeKey) });
            }

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
    const printContent = (content) => { document.getElementById('print-area').innerHTML = content; setTimeout(() => window.print(), 200); };
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
        if (!el) { console.warn(`populateOptions failed: element is null for placeholder "${ph}"`); return; }
        el.innerHTML = `<option value="">${ph}</option>`; 
        (data || []).forEach(item => { 
            el.innerHTML += `<option value="${item[valueKey]}">${item[textKey]}${textKey2 && item[textKey2] ? ' (' + item[textKey2] + ')' : ''}</option>`;
        }); 
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
                    // This is handled by the new multi-select logic or removed
                });
            }
        }
        if (sectionCode && !userCan('viewAllBranches')) {
            ['section-consumption-select', 'tx-filter-section'].forEach(id => {
                // This is handled by the new multi-select logic or removed
            });
        }
    }

    const refreshViewData = async (viewId) => {
        if (!state.currentUser) return;
        Logger.debug(`Refreshing view: ${viewId}`);

        switch(viewId) {
            case 'dashboard':
                const stock = calculateStockLevels();
                document.getElementById('dashboard-total-items').textContent = (state.items || []).length.toLocaleString();
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
                populateOptions(document.getElementById('item-supplier'), state.suppliers, _t('select_supplier'), 'supplierCode', 'name');
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
                populateOptions(document.getElementById('receive-supplier'), state.suppliers, _t('select_supplier'), 'supplierCode', 'name');
                populateOptions(document.getElementById('receive-branch'), state.branches, _t('select_a_branch'), 'branchCode', 'branchName');
                populateOptions(document.getElementById('transfer-from-branch'), state.branches, _t('select_a_branch'), 'branchCode', 'branchName');
                populateOptions(document.getElementById('transfer-to-branch'), state.branches, _t('select_a_branch'), 'branchCode', 'branchName');
                populateOptions(document.getElementById('issue-from-branch'), state.branches, _t('select_a_branch'), 'branchCode', 'branchName');
                populateOptions(document.getElementById('issue-to-section'), state.sections, _t('select_a_section'), 'sectionCode', 'sectionName');
                populateOptions(document.getElementById('return-supplier'), state.suppliers, _t('select_supplier'), 'supplierCode', 'name');
                populateOptions(document.getElementById('return-branch'), state.branches, _t('select_a_branch'), 'branchCode', 'branchName');
                populateOptions(document.getElementById('adjustment-branch'), state.branches, _t('select_a_branch'), 'branchCode', 'branchName');
                populateOptions(document.getElementById('fin-adj-supplier'), state.suppliers, _t('select_supplier'), 'supplierCode', 'name');
                const openPOs = (state.purchaseOrders || []).filter(po => po.Status === 'Approved');
                populateOptions(document.getElementById('receive-po-select'), openPOs, _t('select_a_po'), 'poId', 'poId', 'supplierCode');
                document.getElementById('issue-ref').value = generateId('ISN'); document.getElementById('transfer-ref').value = generateId('TRN');
                renderReceiveListTable(); renderIssueListTable(); renderTransferListTable(); renderReturnListTable(); renderPendingTransfers(); renderInTransitReport(); renderAdjustmentListTable();
                break;
            case 'purchasing':
                 document.querySelector('[data-subview="create-po"]').style.display = userCan('opCreatePO') ? 'inline-block' : 'none';
                 document.querySelector('[data-subview="view-pos"]').style.display = userCan('opCreatePO') || userCan('opApproveFinancials') ? 'inline-block' : 'none';
                 document.querySelector('[data-subview="pending-financial-approval"]').style.display = userCan('opApproveFinancials') ? 'inline-block' : 'none';
                 populateOptions(document.getElementById('po-supplier'), state.suppliers, _t('select_supplier'), 'supplierCode', 'name');
                 document.getElementById('po-ref').value = generateId('PO');
                 renderPOListTable(); renderPurchaseOrdersViewer(); renderPendingFinancials();
                 break;
            case 'requests':
                document.querySelector('[data-subview="my-requests"]').style.display = userCan('opRequestItems') ? 'inline-block' : 'none';
                document.querySelector('[data-subview="pending-approval"]').style.display = userCan('opApproveIssueRequest') || userCan('opApproveResupplyRequest') ? 'inline-block' : 'none';
                renderRequestListTable(); renderMyRequests(); renderPendingRequests();
                break;
            case 'payments':
                populateOptions(document.getElementById('payment-supplier-select'), state.suppliers, _t('select_supplier'), 'supplierCode', 'name');
                renderPaymentList();
                document.getElementById('btn-select-invoices').disabled = true;
                break;
            case 'reports':
                populateOptions(document.getElementById('supplier-statement-select'), state.suppliers, _t('select_a_supplier'), 'supplierCode', 'name');
                // For multi-select, we don't need a placeholder option
                const branchSelect = document.getElementById('consumption-branch-filter');
                branchSelect.innerHTML = '';
                getVisibleBranchesForCurrentUser().forEach(b => branchSelect.innerHTML += `<option value="${b.branchCode}">${b.branchName}</option>`);
                const sectionSelect = document.getElementById('consumption-section-filter');
                sectionSelect.innerHTML = '';
                state.sections.forEach(s => sectionSelect.innerHTML += `<option value="${s.sectionCode}">${s.sectionName}</option>`);
                const itemSelect = document.getElementById('consumption-item-filter');
                itemSelect.innerHTML = '';
                state.items.forEach(i => itemSelect.innerHTML += `<option value="${i.code}">${i.name} (${i.code})</option>`);
                break;
            case 'stock-levels':
                document.getElementById('stock-levels-title').textContent = userCan('viewAllBranches') ? _t('stock_by_item_all_branches') : _t('stock_by_item_your_branch');
                renderItemCentricStockView();
                document.getElementById('item-inquiry-search').value = ''; renderItemInquiry('');
                document.getElementById('stock-levels-search').value = '';
                break;
            case 'transaction-history': 
                populateOptions(document.getElementById('tx-filter-branch'), state.branches, _t('all_branches'), 'branchCode', 'branchName');
                populateOptions(document.getElementById('tx-filter-section'), state.sections, _t('all_sections'), 'sectionCode', 'sectionName');
                populateOptions(document.getElementById('tx-filter-supplier'), state.suppliers, _t('all_suppliers'), 'supplierCode', 'name');
                const txTypes = ['receive', 'issue', 'transfer_out', 'transfer_in', 'return_out', 'po', 'adjustment_in', 'adjustment_out'];
                const txTypeOptions = txTypes.map(t => ({'type': t, 'name': _t(t.replace(/_/g,''))}));
                populateOptions(document.getElementById('tx-filter-type'), txTypeOptions, _t('all_types'), 'type', 'name');
                renderTransactionHistory({
                    startDate: document.getElementById('tx-filter-start-date').value,
                    endDate: document.getElementById('tx-filter-end-date').value,
                    type: document.getElementById('tx-filter-type').value,
                    branch: document.getElementById('tx-filter-branch').value,
                    searchTerm: document.getElementById('transaction-search').value
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
        applyTranslations();
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
            showToast(_t('data_refreshed_toast'), 'success'); 
        } catch (err) { 
            Logger.error('Data reload failed:', err); 
            showToast(_t('data_refresh_fail_toast'), 'error'); 
        } finally { 
            setButtonLoading(false, globalRefreshBtn); 
        } 
    }
    
    function renderUserManagementUI() {
        const usersTbody = document.getElementById('table-users').querySelector('tbody');
        usersTbody.innerHTML = '';
        (state.allUsers || []).forEach(user => {
            const tr = document.createElement('tr');
            const assigned = findByKey(state.branches, 'branchCode', user.AssignedBranchCode)?.branchName || findByKey(state.sections, 'sectionCode', user.AssignedSectionCode)?.sectionName || 'N/A';
            const isDisabled = user.isDisabled === true || String(user.isDisabled).toUpperCase() === 'TRUE';
            tr.innerHTML = `<td>${user.Username}</td><td>${user.Name}</td><td>${user.RoleName}</td><td>${assigned}</td><td><span class="status-tag ${isDisabled ? 'status-rejected' : 'status-approved'}">${isDisabled ? 'Disabled' : 'Active'}</span></td><td><button class="secondary small btn-edit" data-type="user" data-id="${user.Username}">${_t('edit')}</button></td>`;
            usersTbody.appendChild(tr);
        });
        const rolesTbody = document.getElementById('table-roles').querySelector('tbody');
        rolesTbody.innerHTML = '';
        (state.allRoles || []).forEach(role => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${role.RoleName}</td><td><button class="secondary small btn-edit" data-type="role" data-id="${role.RoleName}">${_t('edit')}</button></td>`;
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
                    <button class="secondary small btn-view-tx" data-batch-id="${po.poId}" data-type="po">${_t('view_print')}</button>
                    ${canEditPO ? `<button class="secondary small btn-edit-po" data-po-id="${po.poId}">${_t('edit')}</button>` : ''}
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
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">${_t('no_pending_financial_approval')}</td></tr>`;
            return;
        }

        allPending.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(item.date).toLocaleDateString()}</td>
                <td>${_t(item.txType)}</td>
                <td>${item.ref}</td>
                <td>${item.details}</td>
                <td>${(parseFloat(item.value) || 0).toFixed(2)} EGP</td>
                <td>
                    <div class="action-buttons">
                        <button class="primary small btn-approve-financial" data-id="${item.txType === 'po' ? item.poId : item.batchId}" data-type="${item.txType}">${_t('approve')}</button>
                        <button class="danger small btn-reject-financial" data-id="${item.txType === 'po' ? item.poId : item.batchId}" data-type="${item.txType}">${_t('reject')}</button>
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
                <td>${_t(first.Type)}</td>
                <td>${itemsSummary}</td>
                <td><span class="status-tag status-${first.Status.toLowerCase()}">${_t('status_' + first.Status.toLowerCase())}</span></td>
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
            const fromSection = findByKey(state.sections, 'sectionCode', first.FromSection)?.sectionName || first.FromSection;
            const toBranch = findByKey(state.branches, 'branchCode', first.ToBranch)?.branchName || first.ToBranch;
            const itemsSummary = group.map(i => `${i.Quantity} x ${findByKey(state.items, 'code', i.ItemCode)?.name || i.ItemCode}`).join('<br>');
            const tr = document.createElement('tr');
            let canApprove = (first.Type === 'issue' && userCan('opApproveIssueRequest')) || (first.Type === 'resupply' && userCan('opApproveResupplyRequest'));
            let approveBtnText = first.Type === 'issue' ? 'Edit & Approve' : 'Approve';

            tr.innerHTML = `
                <td>${first.RequestID}</td>
                <td>${new Date(first.Date).toLocaleString()}</td>
                <td>${_t(first.Type)}</td>
                <td>${first.RequestedBy}</td>
                <td>${_t('from_branch')}: ${fromSection}<br>${_t('to_branch')}: ${toBranch}</td>
                <td>${itemsSummary}</td>
                <td>
                    <div class="action-buttons">
                        <button class="primary small btn-approve-request" data-id="${first.RequestID}" ${!canApprove ? 'disabled' : ''}>${approveBtnText}</button>
                        <button class="danger small btn-reject-request" data-id="${first.RequestID}" ${!canApprove ? 'disabled' : ''}>${_t('reject')}</button>
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
            const fromBranch = findByKey(state.branches, 'branchCode', t.fromBranchCode)?.branchName || t.fromBranchCode;
            tr.innerHTML = `<td>${new Date(t.date).toLocaleString()}</td><td>${fromBranch}</td><td>${t.ref}</td><td>${t.items.length}</td><td><button class="primary small btn-receive-transfer" data-batch-id="${t.batchId}">${_t('view_confirm')}</button></td>`;
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
            const fromBranch = findByKey(state.branches, 'branchCode', t.fromBranchCode)?.branchName || t.fromBranchCode;
            const toBranch = findByKey(state.branches, 'branchCode', t.toBranchCode)?.branchName || t.toBranchCode;
            const canManage = (userCan('viewAllBranches') || t.fromBranchCode === state.currentUser.AssignedBranchCode) && t.Status === 'In Transit';
            const actions = canManage ? `<div class="action-buttons"><button class="secondary small btn-edit-transfer" data-batch-id="${t.batchId}">${_t('edit')}</button><button class="danger small btn-cancel-transfer" data-batch-id="${t.batchId}">${_t('cancel')}</button></div>` : 'N/A';
            tr.innerHTML = `<td>${new Date(t.date).toLocaleString()}</td><td>${fromBranch}</td><td>${toBranch}</td><td>${t.ref}</td><td>${t.items.length}</td><td><span class="status-tag status-${t.Status.toLowerCase().replace(/ /g,'')}">${_t('status_' + t.Status.toLowerCase().replace(/ /g, ''))}</span></td><td>${actions}</td>`;
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
            document.getElementById('pending-requests-widget-text').textContent = _t('pending_requests_widget', {count: ''}); // update text, leave number separate
            widget.style.display = 'flex';
        } else {
            widget.style.display = 'none';
        }
    }

    function setupSearch(inputId, renderFn, dataKey, searchKeys) { const searchInput = document.getElementById(inputId); if (!searchInput) return; searchInput.addEventListener('input', e => { const searchTerm = e.target.value.toLowerCase(); const dataToFilter = state[dataKey] || []; renderFn(searchTerm ? dataToFilter.filter(item => searchKeys.some(key => item[key] && String(item[key]).toLowerCase().includes(searchTerm))) : dataToFilter); }); }
    
    function attachSubNavListeners() { document.querySelectorAll('.sub-nav').forEach(nav => { if(nav.closest('#history-modal')) return; nav.addEventListener('click', e => { if (!e.target.classList.contains('sub-nav-item')) return; const subviewId = e.target.dataset.subview; const parentView = e.target.closest('.view'); if (!parentView) return; const currentActive = parentView.querySelector('.sub-nav-item.active'); if(currentActive) currentActive.classList.remove('active'); e.target.classList.add('active'); parentView.querySelectorAll('.sub-view').forEach(view => view.classList.remove('active')); const subViewToShow = parentView.querySelector(`#subview-${subviewId}`); if (subViewToShow) subViewToShow.classList.add('active'); refreshViewData(parentView.id.replace('view-','')); }); }); }
    
    function attachEventListeners() {
        btnLogout.addEventListener('click', logout);
        globalRefreshBtn.addEventListener('click', reloadDataAndRefreshUI);
        
        document.getElementById('btn-create-backup').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            if (confirm(_t('backup_confirm_prompt'))) {
                const result = await postData('createBackup', {}, btn);
                if (result && result.data) {
                    showToast(_t('backup_created_toast', {fileName: result.data.fileName}), 'success');
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
                    showToast(_t('restore_find_id_fail_toast'), 'error');
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
            if (btn.id === 'btn-add-new-role') { const roleName = prompt(_t('add_role_prompt')); if(roleName) { postData('addRole', { RoleName: roleName }, btn).then(res => res && reloadDataAndRefreshUI()); } }
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
            if (btn.classList.contains('btn-edit-transfer')) { openPOEditModal(btn.dataset.batchId); } // Re-using PO edit modal for transfers
            if (btn.classList.contains('btn-cancel-transfer')) { const batchId = btn.dataset.batchId; if (confirm(`Are you sure you want to cancel transfer ${batchId}?`)) { postData('cancelTransfer', { batchId }, btn).then(res => res && reloadDataAndRefreshUI()); } }
            if(btn.classList.contains('btn-approve-request')) { openApproveRequestModal(btn.dataset.id); } 
            if (btn.classList.contains('btn-reject-request')) { const requestId = btn.dataset.id; if(confirm(`Are you sure you want to reject request ${requestId}?`)) { postData('rejectItemRequest', { requestId }, btn).then(res => res && reloadDataAndRefreshUI()); } }
            if (btn.id === 'btn-print-pending-requests') {
                const tableToPrint = document.getElementById('table-pending-requests');
                if (tableToPrint) {
                    const printableDoc = `<div class="printable-document"><h2>${_t('req_pending_approval')}</h2><p>Date: ${new Date().toLocaleString()}</p>${tableToPrint.outerHTML}</div>`;
                    printContent(printableDoc);
                }
            }
            if (btn.classList.contains('btn-edit-po')) { openPOEditModal(btn.dataset.poId); }
            if (btn.classList.contains('btn-edit-invoice')) { openInvoiceEditModal(btn.dataset.batchId); }
            if (btn.classList.contains('btn-approve-financial') || btn.classList.contains('btn-reject-financial')) {
                const id = btn.dataset.id;
                const type = btn.dataset.type;
                const action = btn.classList.contains('btn-approve-financial') ? 'approveFinancial' : 'rejectFinancial';
                const confirmationText = action === 'approveFinancial' ? _t('approve_confirm_prompt', {type: _t(type)}) : _t('reject_confirm_prompt', {type: _t(type)});
                
                if (confirm(confirmationText)) {
                    postData(action, { id, type }, btn).then(result => {
                        if (result) {
                            showToast(action.includes('approve') ? _t('approved_toast', {type: _t(type)}) : _t('rejected_toast', {type: _t(type)}), 'success');
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
        document.getElementById('form-add-item').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const data = { code: document.getElementById('item-code').value, barcode: document.getElementById('item-barcode').value, name: document.getElementById('item-name').value, unit: document.getElementById('item-unit').value, category: document.getElementById('item-category').value, supplierCode: document.getElementById('item-supplier').value, cost: parseFloat(document.getElementById('item-cost').value) }; const result = await postData('addItem', data, btn); if (result) { showToast(_t('add_success_toast', {type: _t('item')}), 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-add-supplier').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const data = { supplierCode: document.getElementById('supplier-code').value, name: document.getElementById('supplier-name').value, contact: document.getElementById('supplier-contact').value }; const result = await postData('addSupplier', data, btn); if (result) { showToast(_t('add_success_toast', {type: _t('supplier')}), 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-add-branch').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const data = { branchCode: document.getElementById('branch-code').value, branchName: document.getElementById('branch-name').value }; const result = await postData('addBranch', data, btn); if (result) { showToast(_t('add_success_toast', {type: _t('branch')}), 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
        document.getElementById('form-add-section').addEventListener('submit', async e => { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); const data = { sectionCode: document.getElementById('section-code').value, sectionName: document.getElementById('section-name').value }; const result = await postData('addSection', data, btn); if (result) { showToast(_t('add_success_toast', {type: _t('section')}), 'success'); e.target.reset(); reloadDataAndRefreshUI(); } });
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

        document.getElementById('btn-submit-receive-batch').addEventListener('click', async (e) => { const btn = e.currentTarget; let branchCode = document.getElementById('receive-branch').value; const supplierCode = document.getElementById('receive-supplier').value, invoiceNumber = document.getElementById('receive-invoice').value, notes = document.getElementById('receive-notes').value, poId = document.getElementById('receive-po-select').value; if(userCan('viewAllBranches') && !state.currentUser.AssignedBranchCode) { const context = await requestAdminContext({ branch: true }); if(!context) return; branchCode = context.branch; } if (!userCan('opReceiveWithoutPO') && !poId) { showToast(_t('select_po_first_toast'), 'error'); return; } if (!supplierCode || !branchCode || !invoiceNumber || state.currentReceiveList.length === 0) { showToast(_t('fill_required_fields_toast'), 'error'); return; } const payload = { type: 'receive', batchId: `GRN-${Date.now()}`, supplierCode, branchCode, invoiceNumber, poId, date: new Date().toISOString(), items: state.currentReceiveList.map(i => ({...i, type: 'receive'})), notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-transfer-batch').addEventListener('click', async (e) => { const btn = e.currentTarget; let fromBranchCode = document.getElementById('transfer-from-branch').value, toBranchCode = document.getElementById('transfer-to-branch').value; const notes = document.getElementById('transfer-notes').value, ref = document.getElementById('transfer-ref').value; if(userCan('viewAllBranches') && !state.currentUser.AssignedBranchCode) { const context = await requestAdminContext({ fromBranch: true, toBranch: true }); if(!context) return; fromBranchCode = context.fromBranch; toBranchCode = context.toBranch; } if (!fromBranchCode || !toBranchCode || fromBranchCode === toBranchCode || state.currentTransferList.length === 0) { showToast('Please select valid branches and add at least one item.', 'error'); return; } const payload = { type: 'transfer_out', batchId: ref, ref: ref, fromBranchCode, toBranchCode, date: new Date().toISOString(), items: state.currentTransferList.map(i => ({...i, type: 'transfer_out'})), notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-issue-batch').addEventListener('click', async(e) => { const btn = e.currentTarget; let fromBranchCode = document.getElementById('issue-from-branch').value, sectionCode = document.getElementById('issue-to-section').value; const ref = document.getElementById('issue-ref').value, notes = document.getElementById('issue-notes').value; if(userCan('viewAllBranches') && !state.currentUser.AssignedBranchCode) { const context = await requestAdminContext({ fromBranch: true, toSection: true }); if(!context) return; fromBranchCode = context.fromBranch; sectionCode = context.toSection; } if (!fromBranchCode || !sectionCode || !ref || state.currentIssueList.length === 0) { showToast('Please fill all issue details and select at least one item.', 'error'); return; } const payload = { type: 'issue', batchId: ref, ref: ref, fromBranchCode, sectionCode, date: new Date().toISOString(), items: state.currentIssueList.map(i => ({...i, type: 'issue'})), notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-po').addEventListener('click', async (e) => { const btn = e.currentTarget; const supplierCode = document.getElementById('po-supplier').value, poId = document.getElementById('po-ref').value, notes = document.getElementById('po-notes').value; if (!supplierCode || state.currentPOList.length === 0) { showToast('Please select a supplier and add items.', 'error'); return; } const totalValue = state.currentPOList.reduce((acc, item) => acc + ((parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0)), 0); const payload = { type: 'po', poId, supplierCode, date: new Date().toISOString(), items: state.currentPOList, totalValue, notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-return').addEventListener('click', async (e) => { const btn = e.currentTarget; const supplierCode = document.getElementById('return-supplier').value; let fromBranchCode = document.getElementById('return-branch').value; const ref = document.getElementById('return-ref').value, notes = document.getElementById('return-notes').value; if(userCan('viewAllBranches') && !state.currentUser.AssignedBranchCode) { const context = await requestAdminContext({ fromBranch: true }); if(!context) return; fromBranchCode = context.fromBranch; } if (!supplierCode || !fromBranchCode || !ref || state.currentReturnList.length === 0) { showToast('Please fill all required fields and add items.', 'error'); return; } const payload = { type: 'return_out', batchId: `RTN-${Date.now()}`, ref: ref, supplierCode, fromBranchCode, date: new Date().toISOString(), items: state.currentReturnList.map(i => ({...i, type: 'return_out'})), notes }; await handleTransactionSubmit(payload, btn); });
        document.getElementById('btn-submit-request').addEventListener('click', async(e) => { const btn = e.currentTarget; let fromSection = state.currentUser.AssignedSectionCode, toBranch = state.currentUser.AssignedBranchCode; const requestType = document.getElementById('request-type').value; const notes = document.getElementById('request-notes').value; if(userCan('viewAllBranches') && (!fromSection || !toBranch)) { const context = await requestAdminContext({ toBranch: true, fromSection: true }); if(!context) return; fromSection = context.fromSection; toBranch = context.toBranch; } if(state.currentRequestList.length === 0){ showToast('Please select items for your request.', 'error'); return; } if(!fromSection || !toBranch){ showToast('Your user is not assigned a branch/section to make requests. Please contact an admin.', 'error'); return; } const payload = { requestId: `REQ-${Date.now()}`, requestType, notes, items: state.currentRequestList, FromSection: fromSection, ToBranch: toBranch }; const result = await postData('addItemRequest', payload, btn); if(result){ showToast('Request submitted successfully!', 'success'); state.currentRequestList = []; document.getElementById('form-create-request').reset(); renderRequestListTable(); reloadDataAndRefreshUI(); }});
        
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
        setupInputTableListeners('table-transfer-list', 'currentTransferList', renderTransferListTable);
        setupInputTableListeners('table-issue-list', 'currentIssueList', renderIssueListTable);
        setupInputTableListeners('table-po-list', 'currentPOList', renderPOListTable);
        setupInputTableListeners('table-edit-po-list', 'currentEditingPOList', renderPOEditListTable);
        setupInputTableListeners('table-return-list', 'currentReturnList', renderReturnListTable);
        setupInputTableListeners('table-request-list', 'currentRequestList', renderRequestListTable);
        setupInputTableListeners('table-adjustment-list', 'currentAdjustmentList', renderAdjustmentListTable);
        
        document.getElementById('btn-submit-adjustment').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            let branchCode = document.getElementById('adjustment-branch').value;
            const ref = document.getElementById('adjustment-ref').value;
            const notes = document.getElementById('adjustment-notes').value;
            if(userCan('viewAllBranches') && !state.currentUser.AssignedBranchCode) { const context = await requestAdminContext({ branch: true }); if(!context) return; branchCode = context.branch; }
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
        document.getElementById('btn-generate-consumption-report').addEventListener('click', renderUnifiedConsumptionReport);
        
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
                    searchTerm: document.getElementById('transaction-search').value
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
        document.querySelector('.sidebar-header h1').textContent = _t('hi_user', {userFirstName});
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
        attachEventListeners(); // Must be before attachSubNavListeners
        attachSubNavListeners(); 
        setupSearch('search-items', renderItemsTable, 'items', ['name', 'code', 'category']);
        setupSearch('search-suppliers', renderSuppliersTable, 'suppliers', ['name', 'supplierCode']);
        setupSearch('search-branches', renderBranchesTable, 'branches', ['branchName', 'branchCode']);
        setupSearch('search-sections', renderSectionsTable, 'sections', ['sectionName', 'sectionCode']);
        setupSearch('stock-levels-search', renderItemCentricStockView, 'items', ['name', 'code']);
        document.getElementById('item-inquiry-search').addEventListener('input', e => renderItemInquiry(e.target.value.toLowerCase()));
        
        document.getElementById('btn-export-items').addEventListener('click', () => exportToExcel('table-items', 'ItemList.xlsx'));
        document.getElementById('btn-export-suppliers').addEventListener('click', () => exportToExcel('table-suppliers', 'SupplierList.xlsx'));
        document.getElementById('btn-export-branches').addEventListener('click', () => exportToExcel('table-branches', 'BranchList.xlsx'));
        document.getElementById('btn-export-sections').addEventListener('click', () => exportToExcel('table-sections', 'SectionList.xlsx'));
        document.getElementById('btn-export-stock').addEventListener('click', () => exportToExcel('table-stock-levels-by-item', 'StockLevels.xlsx'));
        document.getElementById('btn-export-supplier-statement').addEventListener('click', () => exportToExcel('table-supplier-statement-report', 'SupplierStatement.xlsx'));
        document.getElementById('btn-export-consumption-report').addEventListener('click', () => exportToExcel('table-consumption-report', 'ConsumptionReport.xlsx'));

        updateUserBranchDisplay();
        updatePendingRequestsWidget();
        const firstVisibleView = document.querySelector('#main-nav .nav-item:not([style*="display: none"]) a')?.dataset.view || 'dashboard';
        showView(firstVisibleView, null);
        Logger.info('Application initialized successfully.');
    }
    
    function updateUserBranchDisplay() {
        const displayEl = document.getElementById('user-branch-display');
        if (!state.currentUser || !displayEl) { return; }
        const branch = findByKey(state.branches, 'branchCode', state.currentUser.AssignedBranchCode);
        const section = findByKey(state.sections, 'sectionCode', state.currentUser.AssignedSectionCode);
        let displayText = '';
        if (branch) displayText += `${_t('branch')}: ${branch.branchName}`;
        if (section) displayText += `${displayText ? ' / ' : ''}${_t('section')}: ${section.sectionName}`;
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
                <div class="form-group"><label>${_t('table_h_po_no')}</label><input type="text" id="edit-po-id" value="${po.poId}" readonly></div>
                <div class="form-group"><label>${_t('supplier')}</label><input type="text" value="${findByKey(state.suppliers, 'supplierCode', po.supplierCode)?.name}" readonly></div>
                <div class="form-group span-full"><label for="edit-po-notes">${_t('notes_optional')}</label><textarea id="edit-po-notes" rows="2">${po.notes || ''}</textarea></div>
            </div>
            <div class="card" style="margin-top: 20px;">
                <h2 data-translate-key="items_to_order">${_t('items_to_order')}</h2>
                <table id="table-edit-po-list">
                    <thead><tr><th>${_t('table_h_code')}</th><th>${_t('item_name')}</th><th>${_t('table_h_quantity')}</th><th>${_t('table_h_cost_per_unit')}</th><th>${_t('table_h_total')}</th><th>${_t('table_h_actions')}</th></tr></thead>
                    <tbody></tbody>
                    <tfoot><tr style="font-weight: bold; background-color: var(--bg-color);"><td colspan="4" style="text-align: right;">${_t('grand_total')}</td><td id="edit-po-grand-total" colspan="2">0.00 EGP</td></tr></tfoot>
                </table>
                <div style="margin-top: 20px;"><button type="button" data-context="edit-po" class="secondary">${_t('select_items')}</button></div>
            </div>
        `;
        
        const modal = document.getElementById('edit-po-modal');
        modal.querySelector('.modal-footer').innerHTML = `
            <button class="secondary modal-cancel">${_t('cancel')}</button>
            <button id="btn-print-draft-po" class="secondary">${_t('print_list')}</button>
            <button id="btn-save-po-changes" class="primary" data-po-id="${po.poId}">${_t('save_changes')}</button>
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
                <div class="form-group"><label>${_t('supplier')}</label><input type="text" value="${supplier?.name || 'N/A'}" readonly></div>
                <div class="form-group"><label>${_t('branch')}</label><input type="text" value="${branch?.branchName || 'N/A'}" readonly></div>
                <div class="form-group"><label for="edit-invoice-number">${_t('table_h_invoice_no')}</label><input type="text" id="edit-invoice-number" value="${firstTx.invoiceNumber || ''}" required></div>
                <div class="form-group span-full"><label for="edit-invoice-notes">${_t('notes_optional')}</label><textarea id="edit-invoice-notes" rows="2">${firstTx.notes || ''}</textarea></div>
            </div>
            <div class="card" style="margin-top: 20px;">
                <h2 data-translate-key="items_to_be_received">${_t('items_to_be_received')}</h2>
                <table id="table-edit-po-list">
                    <thead><tr><th>${_t('table_h_code')}</th><th>${_t('item_name')}</th><th>${_t('table_h_quantity')}</th><th>${_t('table_h_cost_per_unit')}</th><th>${_t('table_h_total')}</th><th>${_t('table_h_actions')}</th></tr></thead>
                    <tbody></tbody>
                    <tfoot><tr style="font-weight: bold; background-color: var(--bg-color);"><td colspan="4" style="text-align: right;">${_t('grand_total')}</td><td id="edit-po-grand-total" colspan="2">0.00 EGP</td></tr></tfoot>
                </table>
                <div style="margin-top: 20px;"><button type="button" data-context="edit-po" class="secondary">${_t('select_items')}</button></div>
            </div>
        `;

        const modal = document.getElementById('edit-po-modal');
        document.getElementById('edit-po-modal-title').textContent = _t('edit') + ' ' + _t('receive_stock');
        modal.querySelector('.modal-footer').innerHTML = `
            <button type="button" class="secondary modal-cancel">${_t('cancel')}</button>
            <button id="btn-save-invoice-changes" class="primary" data-batch-id="${batchId}">${_t('save_changes')}</button>
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
        
        document.getElementById('approve-request-modal-title').textContent = `${_t('approve')} ${_t('request')}: ${requestId}`;
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
            <p><strong>${_t('from_section')}:</strong> ${findByKey(state.sections, 'sectionCode', first.FromSection)?.sectionName}</p>
            <p><strong>${_t('to_branch')}:</strong> ${findByKey(state.branches, 'branchCode', first.ToBranch)?.branchName}</p>
            <p><strong>${_t('notes_optional')}:</strong> ${first.Notes || 'N/A'}</p>
            <hr>
            <table id="table-approve-request-items">
                <thead><tr><th>${_t('table_h_code')}</th><th>${_t('item')}</th><th>Qty Req.</th><th>${_t('table_h_available')}</th><th>${_t('table_h_qty_to_issue')}</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="form-group" style="margin-top: 20px;">
                <label for="approve-status-notes">${_t('notes_optional')}</label>
                <textarea id="approve-status-notes" rows="2" placeholder="e.g., Partial issue due to stock availability."></textarea>
            </div>
        `;
        
        const modal = document.getElementById('approve-request-modal');
        const confirmBtn = modal.querySelector('#btn-confirm-request-approval');
        confirmBtn.dataset.requestId = requestId; // <-- CRITICAL FIX HERE
        
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

    // Admin Context Selector
    async function requestAdminContext(config) {
        const modal = document.getElementById('context-selector-modal');
        
        // Hide all first
        modal.querySelectorAll('.form-group').forEach(el => el.style.display = 'none');
        
        // Populate and show required dropdowns
        if(config.fromBranch) populateOptions(document.getElementById('context-from-branch-select'), state.branches, 'Select From Branch', 'branchCode', 'branchName');
        if(config.toBranch) populateOptions(document.getElementById('context-to-branch-select'), state.branches, 'Select To Branch', 'branchCode', 'branchName');
        if(config.branch) populateOptions(document.getElementById('context-branch-select'), state.branches, 'Select Branch', 'branchCode', 'branchName');
        if(config.toSection) populateOptions(document.getElementById('context-to-section-select'), state.sections, 'Select To Section', 'sectionCode', 'sectionName');
        if(config.fromSection) populateOptions(document.getElementById('context-from-section-select'), state.sections, 'Select From Section', 'sectionCode', 'sectionName');


        Object.keys(config).forEach(key => {
            const group = document.getElementById(`context-modal-${key}-group`);
            if(group) group.style.display = 'block';
        });

        modal.classList.add('active');
        return new Promise((resolve, reject) => {
            state.adminContextPromise = { resolve, reject };
        });
    }

    function init() {
        // Set up language switcher
        const langSwitcher = document.getElementById('lang-switcher');
        const savedLang = localStorage.getItem('userLanguage') || 'en';
        state.currentLanguage = savedLang;
        langSwitcher.value = savedLang;
        applyTranslations();
        langSwitcher.addEventListener('change', e => {
            const selectedLang = e.target.value;
            localStorage.setItem('userLanguage', selectedLang);
            state.currentLanguage = selectedLang;
            reloadDataAndRefreshUI();
        });
        
        // Listener for the new admin context modal
        document.getElementById('btn-confirm-context').addEventListener('click', () => {
            const modal = document.getElementById('context-selector-modal');
            const context = {
                fromBranch: modal.querySelector('#context-modal-fromBranch-group').style.display === 'block' ? modal.querySelector('#context-from-branch-select').value : null,
                toBranch: modal.querySelector('#context-modal-toBranch-group').style.display === 'block' ? modal.querySelector('#context-to-branch-select').value : null,
                branch: modal.querySelector('#context-modal-branch-group').style.display === 'block' ? modal.querySelector('#context-branch-select').value : null,
                toSection: modal.querySelector('#context-modal-toSection-group').style.display === 'block' ? modal.querySelector('#context-to-section-select').value : null,
                fromSection: modal.querySelector('#context-modal-fromSection-group').style.display === 'block' ? modal.querySelector('#context-from-section-select').value : null,
            };

            // Check if any visible select is unselected
            if (Object.entries(context).some(([key, value]) => modal.querySelector(`#context-modal-${key}-group`).style.display === 'block' && !value)) {
                showToast('Please make a selection for all required fields.', 'error');
                return;
            }
            if (state.adminContextPromise.resolve) state.adminContextPromise.resolve(context);
            modal.classList.remove('active');
        });


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
