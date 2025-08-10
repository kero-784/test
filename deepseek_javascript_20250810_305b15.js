// =================================================================
// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNqNxS8aKrFSERj3JNRTyIOwf4VQCRdMM5hyCUWvuiifJZkzWYvNsmT0P5RZsnbipKNg/exec";
// =================================================================

// --- STATE & CONSTANTS ---
let APP_DATA = { branches: [], sections: [], tasks: [] };
let NOTIFICATIONS = [];
let reportChart = null;
let latestReportId = 0; 
let CALENDAR = null;
const LOADER = document.getElementById('loading-overlay');
const editTaskModal = new bootstrap.Modal(document.getElementById('edit-task-modal'));
const confirmModal = new bootstrap.Modal(document.getElementById('confirm-modal'));
let confirmCallback = () => {};

// --- API & DATA HANDLING ---

/**
 * Unified API function using Promises for cleaner async handling.
 * @param {string} action - The server-side function to call.
 * @param {object} payload - The data to send.
 * @returns {Promise<any>} A promise that resolves with the response data.
 */
function apiCall(action, payload = {}) {
    LOADER.style.display = 'flex';
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        window[callbackName] = (response) => {
            delete window[callbackName];
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
            if (response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response.message || 'An unknown error occurred.'));
            }
        };

        const script = document.createElement('script');
        const payloadString = encodeURIComponent(JSON.stringify(payload));
        script.src = `${SCRIPT_URL}?action=${action}&payload=${payloadString}&callback=${callbackName}`;
        script.onerror = () => {
            delete window[callbackName];
             if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
            reject(new Error('Network error: Could not communicate with the server.'));
        };
        document.body.appendChild(script);
    }).catch(error => {
        showToast(`Error: ${error.message}`, 'danger');
        throw error; // Re-throw to allow individual catch blocks
    }).finally(() => {
        LOADER.style.display = 'none';
    });
}

/**
 * Fetches all initial data and triggers a full re-render.
 */
async function initializeApp() {
    try {
        APP_DATA = await apiCall('getInitialData');
        NOTIFICATIONS = await apiCall('getNotifications');
        renderAllViews();
        addEventListeners();
        setupCalendar();
        updateNotificationBadge();
        showView('dashboard');
    } catch (error) {
        document.getElementById('main-content').innerHTML = `
            <div class="alert alert-danger">
                <h4><i class="bi bi-exclamation-triangle-fill"></i> Failed to load application data</h4>
                <p>Could not connect to the server. Please check your internet connection and try refreshing the page.</p>
                <p class="small mb-0">Error: ${error.message}</p>
            </div>`;
    }
}

/**
 * Fetches fresh data and intelligently re-renders only necessary parts of the UI.
 * @param {object} options - Control which views to refresh.
 */
async function handleDataRefresh(message, { dashboard = true, tasks = false, management = false, reports = false, calendar = false } = {}) {
    showToast(message, 'success');
    APP_DATA = await apiCall('getInitialData');
    NOTIFICATIONS = await apiCall('getNotifications');
    updateNotificationBadge();
    
    if (dashboard) renderDashboardView();
    if (tasks) renderTasks();
    if (management) renderManagementLists();
    if (reports) renderReportFilters();
    if (calendar) refreshCalendar();
}

// --- CALENDAR FUNCTIONS ---
function setupCalendar() {
    const calendarEl = document.getElementById('calendar-view');
    CALENDAR = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: APP_DATA.tasks.map(task => ({
            title: task.title,
            start: task.deadline ? new Date(task.deadline) : new Date(),
            end: task.deadline ? new Date(new Date(task.deadline).getTime() + 3600000) : new Date(new Date().getTime() + 3600000),
            extendedProps: {
                description: task.description,
                status: task.status,
                priority: task.priority || 'medium',
                taskId: task.id
            },
            backgroundColor: getPriorityColor(task.priority),
            borderColor: getPriorityColor(task.priority)
        })),
        eventClick: function(info) {
            showTaskDetailsModal(info.event);
        },
        eventContent: function(arg) {
            const priorityDot = document.createElement('div');
            priorityDot.className = 'priority-dot';
            priorityDot.style.backgroundColor = getPriorityColor(arg.event.extendedProps.priority);
            
            const titleEl = document.createElement('div');
            titleEl.innerText = arg.event.title;
            titleEl.className = 'fc-event-title';
            
            const container = document.createElement('div');
            container.className = 'fc-event-container';
            container.appendChild(priorityDot);
            container.appendChild(titleEl);
            
            return { domNodes: [container] };
        }
    });
    CALENDAR.render();
}

function refreshCalendar() {
    if (CALENDAR) {
        CALENDAR.removeAllEvents();
        CALENDAR.addEventSource(APP_DATA.tasks.map(task => ({
            title: task.title,
            start: task.deadline ? new Date(task.deadline) : new Date(),
            end: task.deadline ? new Date(new Date(task.deadline).getTime() + 3600000) : new Date(new Date().getTime() + 3600000),
            extendedProps: {
                description: task.description,
                status: task.status,
                priority: task.priority || 'medium',
                taskId: task.id
            },
            backgroundColor: getPriorityColor(task.priority),
            borderColor: getPriorityColor(task.priority)
        })));
    }
}

function getPriorityColor(priority) {
    const colors = {
        high: '#dc3545',
        medium: '#ffc107',
        low: '#28a745'
    };
    return colors[priority] || '#6c757d';
}

function showTaskDetailsModal(event) {
    const task = event.extendedProps;
    const taskData = APP_DATA.tasks.find(t => t.id === task.taskId);
    const assignments = taskData ? taskData.assignments : [];
    
    const modalContent = `
        <div class="modal-header">
            <h5 class="modal-title">${event.title}</h5>
            <span class="badge bg-${task.status === 'Active' ? 'success' : 'secondary'} ms-2">${task.status}</span>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
            <p><strong>Due:</strong> ${event.start.toLocaleString()}</p>
            <p><strong>Priority:</strong> <span class="badge" style="background-color: ${getPriorityColor(task.priority)}">${task.priority || 'medium'}</span></p>
            <p><strong>Description:</strong></p>
            <p>${task.description || 'No description available.'}</p>
            
            ${assignments.length > 0 ? `
            <div class="mt-3">
                <h6>Assignments</h6>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Branch</th>
                                <th>Status</th>
                                <th>Completed</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${assignments.map(a => `
                                <tr>
                                    <td>${APP_DATA.branches.find(b => b.id === a.branchId)?.name || a.branchId}</td>
                                    <td><span class="badge ${a.status === 'Completed' ? 'bg-success' : 'bg-warning'}">${a.status}</span></td>
                                    <td>${a.completionTimestamp || 'Not completed'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            ${task.status === 'Active' ? `
                <button type="button" class="btn btn-primary" data-action="edit-task" data-task-id="${task.taskId}">
                    <i class="bi bi-pencil"></i> Edit Task
                </button>
            ` : ''}
        </div>
    `;
    
    const modal = new bootstrap.Modal(document.createElement('div'));
    modal._element.className = 'modal fade';
    modal._element.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">${modalContent}</div>
        </div>
    `;
    document.body.appendChild(modal._element);
    modal.show();
    
    modal._element.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal._element);
    });
}

// --- NOTIFICATION SYSTEM ---
function updateNotificationBadge() {
    const unreadCount = NOTIFICATIONS.filter(n => !n.read).length;
    document.getElementById('notification-badge').textContent = unreadCount;
}

function renderNotifications() {
    const container = document.getElementById('notifications-list');
    container.innerHTML = NOTIFICATIONS.map(notification => `
        <div class="p-3 border-bottom ${notification.read ? '' : 'bg-light'}" data-notification-id="${notification.id}">
            <div class="d-flex justify-content-between">
                <strong>${notification.title}</strong>
                <small class="text-muted">${formatNotificationTime(notification.timestamp)}</small>
            </div>
            <p class="mb-0">${notification.message}</p>
            ${!notification.read ? `
            <div class="text-end mt-2">
                <button class="btn btn-sm btn-outline-primary" data-action="mark-notification-read" data-notification-id="${notification.id}">
                    Mark as read
                </button>
            </div>
            ` : ''}
        </div>
    `).join('') || '<div class="p-3 text-center text-muted">No notifications</div>';
}

function formatNotificationTime(timestamp) {
    const now = new Date();
    const notifDate = new Date(timestamp);
    const diffHours = Math.floor((now - notifDate) / (1000 * 60 * 60));
    
    if (diffHours < 1) {
        return 'Just now';
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
        return notifDate.toLocaleDateString();
    }
}

async function handleMarkAllRead() {
    NOTIFICATIONS = NOTIFICATIONS.map(n => ({ ...n, read: true }));
    await apiCall('markAllNotificationsRead');
    updateNotificationBadge();
    renderNotifications();
    showToast('All notifications marked as read', 'success');
}

async function handleMarkNotificationRead(target) {
    const notificationId = target.dataset.notificationId;
    NOTIFICATIONS = NOTIFICATIONS.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
    );
    
    await apiCall('markNotificationRead', { notificationId });
    updateNotificationBadge();
    renderNotifications();
}

// --- RENDERING ---

function renderAllViews() {
    renderDashboardView();
    renderTasksView();
    renderManagementView();
    renderReportsView();
    renderCalendarView();
}

function renderCalendarView() {
    const view = document.getElementById("calendar-view");
    view.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1>Task Calendar</h1>
            <div class="btn-group">
                <button class="btn btn-outline-secondary" id="calendar-prev">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <button class="btn btn-outline-secondary" id="calendar-today">
                    Today
                </button>
                <button class="btn btn-outline-secondary" id="calendar-next">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </div>
        </div>
        <div id="calendar-container"></div>
        <div class="mt-3">
            <div class="d-flex align-items-center">
                <div class="me-3 d-flex align-items-center">
                    <div class="priority-dot me-2" style="background-color: #dc3545;"></div>
                    <span>High Priority</span>
                </div>
                <div class="me-3 d-flex align-items-center">
                    <div class="priority-dot me-2" style="background-color: #ffc107;"></div>
                    <span>Medium Priority</span>
                </div>
                <div class="d-flex align-items-center">
                    <div class="priority-dot me-2" style="background-color: #28a745;"></div>
                    <span>Low Priority</span>
                </div>
            </div>
        </div>
    `;
}

function renderDashboardView() {
    const view = document.getElementById("dashboard-view");
    const allTasks = APP_DATA.tasks;
    const activeTasks = allTasks.filter(t => t.status === "Active").length;
    const highPriorityTasks = allTasks.filter(t => t.priority === "high" && t.status === "Active").length;
    const allAssignments = allTasks.flatMap(t => t.assignments);
    const pendingAssignments = allAssignments.filter(a => a.status === "Pending").length;
    const branchMap = Object.fromEntries(APP_DATA.branches.map(b => [b.id, b.name]));
    const taskMap = Object.fromEntries(allTasks.map(t => [t.id, t.title]));
    const recentCompletions = allAssignments
        .filter(a => a.status === "Completed" && a.completionTimestamp !== "N/A")
        .sort((a, b) => new Date(b.completionTimestamp.split(" ")[0].split("/").reverse().join("-")) - new Date(a.completionTimestamp.split(" ")[0].split("/").reverse().join("-")))
        .slice(0, 5);
    
    view.innerHTML = `
        <h1 class="mb-4">Dashboard</h1>
        <div class="row g-4">
            <div class="col-md-6 col-xl-3">
                <div class="card stat-card">
                    <div class="card-body">
                        <div class="stat-icon bg-primary-subtle text-primary">
                            <i class="bi bi-list-task"></i>
                        </div>
                        <div>
                            <h5>Active Tasks</h5>
                            <div class="stat-number">${activeTasks}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-xl-3">
                <div class="card stat-card">
                    <div class="card-body">
                        <div class="stat-icon bg-warning-subtle text-warning">
                            <i class="bi bi-hourglass-split"></i>
                        </div>
                        <div>
                            <h5>Pending Assignments</h5>
                            <div class="stat-number">${pendingAssignments}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-xl-3">
                <div class="card stat-card">
                    <div class="card-body">
                        <div class="stat-icon bg-danger-subtle text-danger">
                            <i class="bi bi-exclamation-triangle"></i>
                        </div>
                        <div>
                            <h5>High Priority</h5>
                            <div class="stat-number">${highPriorityTasks}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-xl-3">
                <div class="card stat-card">
                    <div class="card-body">
                        <div class="stat-icon bg-secondary-subtle text-secondary">
                            <i class="bi bi-diagram-3"></i>
                        </div>
                        <div>
                            <h5>Active Sections</h5>
                            <div class="stat-number">${APP_DATA.sections.filter(s => s.status === "Active").length}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-7">
                <div class="card h-100">
                    <div class="card-header">
                        <h4><i class="bi bi-clock-history me-2"></i>Recent Activity</h4>
                    </div>
                    <div class="card-body">
                        <ul class="list-group list-group-flush">
                            ${recentCompletions.length > 0 ? 
                                recentCompletions.map(a => `
                                    <li class="list-group-item">
                                        Branch <strong>${branchMap[a.branchId] || "Unknown"}</strong> 
                                        completed task "<em>${taskMap[a.taskId] || "Unknown"}</em>" 
                                        in ${a.timeTaken}.
                                    </li>
                                `).join("") : 
                                '<li class="list-group-item">No recent completions.</li>'
                            }
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-xl-5">
                <div class="card h-100">
                    <div class="card-header">
                        <h4><i class="bi bi-plus-circle me-2"></i>Create New Task</h4>
                    </div>
                    <div class="card-body" id="create-task-form-container"></div>
                </div>
            </div>
        </div>`;
    renderCreateTaskForm();
}

function renderTasksView() {
    const view = document.getElementById("tasks-view");
    view.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1>All Tasks</h1>
            <div class="d-flex align-items-center">
                <div class="form-check form-switch fs-5 me-3">
                    <input class="form-check-input" type="checkbox" role="switch" id="show-inactive-toggle" data-action="toggle-inactive-tasks">
                    <label class="form-check-label" for="show-inactive-toggle">Show Inactive</label>
                </div>
                <button class="btn btn-primary" data-action="bulk-actions">
                    <i class="bi bi-collection"></i> Bulk Actions
                </button>
            </div>
        </div>
        <div id="task-list-container"></div>`;
    renderTasks();
}

function renderManagementView() {
    const view = document.getElementById("management-view");
    view.innerHTML = `
        <h1 class="mb-4">Branch & Section Management</h1>
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h4 class="mb-0">Manage Branches</h4>
                        <button class="btn btn-sm btn-outline-primary" data-action="export-branches">
                            <i class="bi bi-download"></i> Export
                        </button>
                    </div>
                    <div class="card-body">
                        <form id="branch-form" class="mb-3">
                            <div class="input-group">
                                <input type="text" id="new-branch-name" class="form-control" placeholder="New Branch Name" required>
                                <button class="btn btn-primary" type="submit" data-action="add-entity" data-type="branch">
                                    Add Branch
                                </button>
                            </div>
                        </form>
                        <ul id="branch-list" class="list-group"></ul>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h4 class="mb-0">Manage Sections</h4>
                        <button class="btn btn-sm btn-outline-primary" data-action="export-sections">
                            <i class="bi bi-download"></i> Export
                        </button>
                    </div>
                    <div class="card-body">
                        <form id="section-form" class="mb-3">
                            <div class="input-group">
                                <input type="text" id="new-section-name" class="form-control" placeholder="New Section Name" required>
                                <button class="btn btn-primary" type="submit" data-action="add-entity" data-type="section">
                                    Add Section
                                </button>
                            </div>
                        </form>
                        <ul id="section-list" class="list-group"></ul>
                    </div>
                </div>
            </div>
        </div>`;
    renderManagementLists();
}

function renderReportsView() {
    const view = document.getElementById("reports-view");
    view.innerHTML = `
        <h1 class="mb-4">Reports & Analytics</h1>
        <div class="card mb-4">
            <div class="card-header">Report Filters</div>
            <div class="card-body">
                <div class="row g-3 align-items-end">
                    <div class="col-md-3">
                        <label for="report-type" class="form-label">Report Type</label>
                        <select id="report-type" class="form-select" data-action="toggle-report-options">
                            <option value="task_detail">Task Detail Report</option>
                            <option value="branch_performance">Branch Performance</option>
                            <option value="priority_analysis">Priority Analysis</option>
                        </select>
                    </div>
                    <div class="col-md-4" id="report-task-selector-container">
                        <label for="report-task-selector" class="form-label">Select Task</label>
                        <select id="report-task-selector" class="form-select"></select>
                    </div>
                    <div class="col-md-4" id="report-branch-options-container" style="display: none;">
                        <div class="row">
                            <div class="col-sm-6">
                                <label for="report-start-date" class="form-label">Start Date</label>
                                <input type="date" id="report-start-date" class="form-control">
                            </div>
                            <div class="col-sm-6">
                                <label for="report-end-date" class="form-label">End Date</label>
                                <input type="date" id="report-end-date" class="form-control">
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3" id="report-assessment-container" style="display: none;">
                        <label for="report-assessment-method" class="form-label">Assessment Method</label>
                        <select id="report-assessment-method" class="form-select">
                            <option value="avg_time">Fastest (Average Time)</option>
                            <option value="rank_points">Most Consistent (Rank Points)</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <button class="btn btn-primary w-100" data-action="generate-report">
                            Generate
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div id="report-output-wrapper">
            <div class="p-5 text-center text-muted bg-white rounded-3 border">
                <i class="bi bi-search" style="font-size: 3rem;"></i>
                <h5 class="mt-2">Ready for analysis?</h5>
                <p>Select your report criteria above and click "Generate" to see the results.</p>
            </div>
        </div>`;
    renderReportFilters();
}

function renderCreateTaskForm() {
    const container = document.getElementById("create-task-form-container");
    const activeSections = APP_DATA.sections.filter(s => s.status === "Active");
    const activeBranches = APP_DATA.branches.filter(b => b.status === "Active");
    
    container.innerHTML = `
        <form id="create-task-form">
            <div class="mb-3">
                <label for="task-title" class="form-label">Task Title</label>
                <input type="text" class="form-control" id="task-title" required>
            </div>
            <div class="mb-3">
                <label for="task-description" class="form-label">Description</label>
                <textarea class="form-control" id="task-description" rows="2"></textarea>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label for="task-section" class="form-label">Section</label>
                    <select class="form-select" id="task-section" required>
                        <option value="" disabled selected>Select...</option>
                        ${activeSections.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="task-type" class="form-label">Type</label>
                    <select class="form-select" id="task-type" data-action="toggle-deadline">
                        <option value="Normal">Normal</option>
                        <option value="Time-Limited">Time-Limited</option>
                    </select>
                </div>
            </div>
            <div class="mb-3" id="deadline-container" style="display: none;">
                <label for="task-deadline" class="form-label">Deadline</label>
                <input type="datetime-local" class="form-control" id="task-deadline">
            </div>
            <div class="mb-3">
                <label class="form-label">Priority</label>
                <div class="btn-group w-100" role="group">
                    <input type="radio" class="btn-check" name="priority" id="priority-low" value="low" autocomplete="off">
                    <label class="btn btn-outline-success" for="priority-low">Low</label>
                    <input type="radio" class="btn-check" name="priority" id="priority-medium" value="medium" autocomplete="off" checked>
                    <label class="btn btn-outline-warning" for="priority-medium">Medium</label>
                    <input type="radio" class="btn-check" name="priority" id="priority-high" value="high" autocomplete="off">
                    <label class="btn btn-outline-danger" for="priority-high">High</label>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">Assign to Branches</label>
                <div id="branch-checkboxes" class="border p-2 rounded bg-light" style="max-height: 110px; overflow-y: auto;">
                    ${activeBranches.length > 0 ? 
                        activeBranches.map(b => `
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" value="${b.id}" id="branch-${b.id}">
                                <label class="form-check-label" for="branch-${b.id}">${b.name}</label>
                            </div>
                        `).join("") : 
                        '<p class="text-muted small m-1">No active branches found.</p>'
                    }
                </div>
            </div>
            <button type="submit" class="btn btn-primary w-100" data-action="create-task">
                Create Task
            </button>
        </form>`;
}

function renderTasks() {
    const taskListContainer = document.getElementById("task-list-container");
    const showInactive = document.getElementById("show-inactive-toggle")?.checked || false;
    const tasksToDisplay = showInactive ? APP_DATA.tasks : APP_DATA.tasks.filter(t => t.status === "Active");
    
    if (tasksToDisplay.length === 0) {
        taskListContainer.innerHTML = `
            <div class="alert alert-light border">
                No tasks to display. Create one from the Dashboard or adjust the filter.
            </div>`;
        return;
    }
    
    taskListContainer.innerHTML = tasksToDisplay.map(createTaskCardHTML).join("");
}

function createTaskCardHTML(task) {
    const branchMap = Object.fromEntries(APP_DATA.branches.map(b => [b.id, b.name]));
    const assignmentsHtml = task.assignments.map(a => `
        <tr>
            <td>${branchMap[a.branchId] || a.branchId}</td>
            <td>
                <span class="badge ${a.status === "Completed" ? "bg-success" : "bg-warning"}">
                    ${a.status}
                </span>
            </td>
            <td>${a.completionTimestamp}</td>
            <td>${a.timeTaken}</td>
            <td>
                ${a.status === "Pending" ? `
                    <button class="btn btn-sm btn-primary" data-action="mark-complete" data-assignment-id="${a.assignmentId}">
                        Complete
                    </button>
                ` : ""}
            </td>
        </tr>
    `).join("");
    
    return `
        <div class="card mb-3 task-card ${task.status.toLowerCase()}">
            <div class="card-header d-flex justify-content-between">
                <div>
                    <strong>${task.title}</strong>
                    <span class="badge bg-${task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "success"} ms-2">
                        ${task.priority || 'medium'}
                    </span>
                    <span class="badge bg-secondary ms-1">${task.taskType}</span>
                </div>
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li>
                            <a class="dropdown-item" href="#" data-action="edit-task" data-task-id="${task.id}">
                                <i class="bi bi-pencil-square"></i> Edit
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="#" data-action="toggle-task-status" data-task-id="${task.id}" 
                               data-status="${task.status === "Active" ? "Inactive" : "Active"}">
                                <i class="bi bi-power"></i> ${task.status === "Active" ? "Disable" : "Enable"}
                            </a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a class="dropdown-item text-danger" href="#" data-action="delete-task" data-task-id="${task.id}">
                                <i class="bi bi-trash"></i> Delete
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            <div class="card-body">
                <p>${task.description || "No description."}</p>
                <table class="table table-sm table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th>Branch</th>
                            <th>Status</th>
                            <th>Completed On</th>
                            <th>Time Taken</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody class="task-assignments-body">
                        ${assignmentsHtml}
                    </tbody>
                </table>
            </div>
            <div class="card-footer text-muted">
                Deadline: ${task.deadline || "No deadline"}
            </div>
        </div>`;
}

function renderManagementLists() {
    const branchList = document.getElementById("branch-list");
    const sectionList = document.getElementById("section-list");
    
    branchList.innerHTML = APP_DATA.branches.map(item => createManagementListItemHTML(item, "branch")).join("") || 
        `<li class="list-group-item">No branches found.</li>`;
    
    sectionList.innerHTML = APP_DATA.sections.map(item => createManagementListItemHTML(item, "section")).join("") || 
        `<li class="list-group-item">No sections found.</li>`;
}

function createManagementListItemHTML(item, type) {
    return `
        <li class="list-group-item d-flex justify-content-between align-items-center" data-id="${item.id}">
            <span class="item-name">${item.name}</span>
            <input type="text" class="form-control item-input" value="${item.name}" style="display:none;">
            <div>
                <span class="badge bg-${item.status === "Active" ? "success" : "secondary"} me-2">
                    ${item.status}
                </span>
                <button class="btn btn-sm btn-outline-primary save-btn" data-action="save-entity" data-type="${type}" style="display:none;">
                    <i class="bi bi-check-lg"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary cancel-btn" data-action="cancel-edit-entity" style="display:none;">
                    <i class="bi bi-x-lg"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary edit-btn" data-action="toggle-edit-entity">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary power-btn" data-action="toggle-entity-status" data-type="${type}">
                    <i class="bi bi-power"></i>
                </button>
            </div>
        </li>`;
}

function renderReportFilters() {
    const taskSelector = document.getElementById("report-task-selector");
    taskSelector.innerHTML = '<option value="" disabled selected>Select a task...</option>';
    APP_DATA.tasks.forEach(t => taskSelector.innerHTML += `<option value="${t.id}">${t.title}</option>`);
    
    const today = (new Date).toISOString().split("T")[0];
    document.getElementById("report-end-date").value = today;
    
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    document.getElementById("report-start-date").value = lastMonth.toISOString().split("T")[0];
}

function renderReport(reportData) {
    const outputWrapper = document.getElementById("report-output-wrapper");
    const currentReportId = ++latestReportId;

    if (!reportData || !reportData.table || reportData.table.length === 0) {
        outputWrapper.innerHTML = `
        <div id="report-actions" class="d-flex justify-content-between align-items-center">
            <span class="fw-bold text-danger">Report Generated: No Data</span>
            <div></div>
        </div>
        <div id="report-output-container">
            <div class="alert alert-warning">No data found for the selected criteria. Please adjust your filters and try again.</div>
        </div>`;
        return;
    }

    const headers = Object.keys(reportData.table[0]).filter(h => h !== "Time Taken (s)");
    const tableRows = reportData.table.map(row => {
        const cells = headers.map(h => {
            const isBranchName = h.toLowerCase().includes('branch');
            return isBranchName ? `<td dir="auto">${row[h]}</td>` : `<td>${row[h]}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
    }).join("");

    outputWrapper.innerHTML = `
        <div id="report-actions" class="d-flex justify-content-between align-items-center">
            <span class="fw-bold text-success">Report Generated Successfully</span>
            <div>
                <button class="btn btn-sm btn-outline-secondary me-2" data-action="print-report">
                    <i class="bi bi-printer"></i> Print / PDF
                </button>
                <button class="btn btn-sm btn-outline-success" data-action="export-excel">
                    <i class="bi bi-file-earmark-excel"></i> Export Excel
                </button>
            </div>
        </div>
        <div id="report-output-container">
            <div id="report-content">
                <h4 class="report-main-title">${reportData.title}</h4>
                <div class="row gy-5">
                    <div class="col-md-7">                        <h5 class="report-section-title">Data Table</h5>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
                                </thead>
                                <tbody>${tableRows}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <h5 class="report-section-title">Chart</h5>
                        <div class="position-relative" style="min-height: 350px;">
                            <canvas id="report-chart-canvas"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    setTimeout(() => {
        if (currentReportId !== latestReportId) return;
        if (reportChart) reportChart.destroy();
        
        const ctx = document.getElementById("report-chart-canvas")?.getContext("2d");
        if (!ctx) return; 

        // Chart data calculation
        let finalChartData;
        
        if (reportData.reportType === 'task_detail') {
            const completedCount = reportData.table.filter(row => row.Status === 'Completed').length;
            const pendingCount = reportData.table.filter(row => row.Status === 'Pending').length;
            
            finalChartData = {
                type: 'pie',
                labels: [],
                data: []
            };
            if (completedCount > 0) {
                finalChartData.labels.push('Completed');
                finalChartData.data.push(completedCount);
            }
            if (pendingCount > 0) {
                finalChartData.labels.push('Pending');
                finalChartData.data.push(pendingCount);
            }
        } else if (reportData.reportType === 'priority_analysis') {
            const highCount = APP_DATA.tasks.filter(t => t.priority === 'high').length;
            const mediumCount = APP_DATA.tasks.filter(t => t.priority === 'medium').length;
            const lowCount = APP_DATA.tasks.filter(t => t.priority === 'low').length;
            
            finalChartData = {
                type: 'doughnut',
                labels: ['High', 'Medium', 'Low'],
                data: [highCount, mediumCount, lowCount]
            };
        } else {
            // For other reports, trust the server's pre-aggregated data
            finalChartData = reportData.chartData;
        }

        const chartColors = { 
            pie: ["#22c55e", "#f59e0b"], 
            doughnut: ["#dc3545", "#ffc107", "#28a745"],
            bar: "rgba(79, 70, 229, 0.7)" 
        };
        
        const chartConfig = {
            type: finalChartData.type,
            data: { 
                labels: finalChartData.labels, 
                datasets: [{ 
                    label: "Status", 
                    data: finalChartData.data, 
                    backgroundColor: finalChartData.type === 'pie' ? chartColors.pie : 
                                    finalChartData.type === 'doughnut' ? chartColors.doughnut : 
                                    chartColors.bar, 
                    borderColor: "#fff", 
                    borderWidth: finalChartData.type === "pie" || finalChartData.type === "doughnut" ? 2 : 0 
                }] 
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { 
                        position: 'bottom', 
                        align: 'center',
                        labels: { boxWidth: 12, padding: 20, font: { size: 14 } } 
                    } 
                }, 
            }
        };

        if (finalChartData.type === 'bar') { 
            chartConfig.options.scales = { y: { beginAtZero: true } }; 
            chartConfig.options.plugins.legend.position = 'top';
        }
        
        reportChart = new Chart(ctx, chartConfig);
    }, 10);
}

// --- EVENT HANDLERS ---

function addEventListeners() {
    document.addEventListener('click', e => {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;
        const { action } = actionTarget.dataset;
        
        if (actionTarget.tagName === 'A' || actionTarget.tagName === 'BUTTON') {
            e.preventDefault();
        }
        
        switch(action) {
            case 'show-view': handleShowView(actionTarget); break;
            case 'create-task': handleCreateTask(e); break;
            case 'mark-complete': handleMarkComplete(actionTarget); break;
            case 'edit-task': handleEditTask(actionTarget); break;
            case 'toggle-task-status': handleToggleTaskStatus(actionTarget); break;
            case 'delete-task': handleDeleteTask(actionTarget); break;
            case 'add-entity': handleAddEntity(actionTarget); break;
            case 'toggle-edit-entity': toggleEditEntity(actionTarget, true); break;
            case 'cancel-edit-entity': toggleEditEntity(actionTarget, false); break;
            case 'save-entity': handleSaveEntity(actionTarget); break;
            case 'toggle-entity-status': handleToggleEntityStatus(actionTarget); break;
            case 'generate-report': handleGenerateReport(actionTarget); break;
            case 'export-excel': handleExportExcel(actionTarget); break;
            case 'export-jpg': handleExportJpg(actionTarget); break;
            case 'print-report': window.print(); break;
            case 'mark-all-read': handleMarkAllRead(); break;
            case 'mark-notification-read': handleMarkNotificationRead(actionTarget); break;
            case 'bulk-actions': handleBulkActions(); break;
            case 'export-branches': handleExportBranches(); break;
            case 'export-sections': handleExportSections(); break;
            case 'calendar-prev': CALENDAR.prev(); break;
            case 'calendar-today': CALENDAR.today(); break;
            case 'calendar-next': CALENDAR.next(); break;
        }
    });

    document.addEventListener('change', e => {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;
        const { action } = actionTarget.dataset;
        switch(action) {
            case 'toggle-deadline': toggleDeadline(); break;
            case 'toggle-inactive-tasks': renderTasks(); break;
            case 'toggle-report-options': toggleReportOptions(); break;
        }
    });

    document.getElementById("confirm-modal-button").addEventListener("click", () => {
        if (typeof confirmCallback === "function") confirmCallback();
        confirmModal.hide();
    });
    
    document.getElementById("save-task-changes").addEventListener("click", handleSaveTaskChanges);
    
    // Mobile menu toggle
    document.getElementById('mobile-menu-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
    
    // Notifications dropdown
    document.getElementById('notifications-btn').addEventListener('click', toggleNotifications);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#notifications-dropdown') && !e.target.closest('#notifications-btn')) {
            document.getElementById('notifications-dropdown').classList.remove('show');
        }
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('main-content').classList.toggle('sidebar-collapsed');
}

function toggleNotifications() {
    document.getElementById('notifications-dropdown').classList.toggle('show');
    renderNotifications();
}

function handleShowView(target) { 
    showView(target.dataset.view); 
}

async function handleCreateTask(event) {
    const form = document.getElementById('create-task-form');
    const btn = form.querySelector('[data-action="create-task"]');
    const originalText = btn.innerHTML;
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const selectedBranches = Array.from(document.querySelectorAll("#branch-checkboxes input:checked")).map(cb => cb.value);
    if (selectedBranches.length === 0) {
        showToast("Please assign the task to at least one branch.", "warning");
        return;
    }
    
    setButtonLoading(btn, true, 'Creating...');
    
    const priority = document.querySelector('input[name="priority"]:checked')?.value || 'medium';
    
    const taskData = {
        title: document.getElementById("task-title").value,
        description: document.getElementById("task-description").value,
        section: document.getElementById("task-section").value,
        type: document.getElementById("task-type").value,
        deadline: document.getElementById("task-deadline").value,
        branches: selectedBranches,
        priority: priority
    };
    
    try {
        const data = await apiCall("createTask", taskData);
        form.reset();
        toggleDeadline();
        await handleDataRefresh(data.message, { tasks: true, reports: true, calendar: true });
    } finally {
        setButtonLoading(btn, false, originalText);
    }
}

function handleMarkComplete(target) {
    const assignmentId = target.dataset.assignmentId;
    showConfirmModal("Are you sure you want to mark this task as complete?", async () => {
        const data = await apiCall("markTaskAsComplete", { assignmentId });
        await handleDataRefresh(data.message, { tasks: true, dashboard: true, calendar: true });
    });
}

function handleEditTask(target) {
    const taskId = target.dataset.taskId;
    const task = APP_DATA.tasks.find(t => t.id === taskId);
    if (task) {
        document.getElementById("edit-task-id").value = task.id;
        document.getElementById("edit-task-title").value = task.title;
        document.getElementById("edit-task-description").value = task.description;
        editTaskModal.show();
    }
}

async function handleSaveTaskChanges(event) {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    setButtonLoading(btn, true);
    
    const payload = {
        taskId: document.getElementById("edit-task-id").value,
        title: document.getElementById("edit-task-title").value,
        description: document.getElementById("edit-task-description").value
    };
    
    try {
        const data = await apiCall("updateTask", payload);
        editTaskModal.hide();
        await handleDataRefresh(data.message, { tasks: true, dashboard: true, calendar: true });
    } finally {
        setButtonLoading(btn, false, originalText);
    }
}

function handleToggleTaskStatus(target) {
    const { taskId, status } = target.dataset;
    showConfirmModal(`Are you sure you want to ${status === "Active" ? "enable" : "disable"} this task?`, async () => {
        const data = await apiCall("setTaskStatus", { taskId, status });
        await handleDataRefresh(data.message, { tasks: true, dashboard: true, reports: true, calendar: true });
    });
}

function handleDeleteTask(target) {
    const taskId = target.dataset.taskId;
    showConfirmModal("Are you sure you want to permanently delete this task? This cannot be undone.", async () => {
        const data = await apiCall("deleteTask", { taskId });
        await handleDataRefresh(data.message, { tasks: true, dashboard: true, reports: true, calendar: true });
    });
}

async function handleAddEntity(target) {
    const { type } = target.dataset;
    const input = document.getElementById(`new-${type}-name`);
    const name = input.value.trim();
    
    if (!name) return;
    
    const originalText = target.innerHTML;
    setButtonLoading(target, true, 'Adding...');
    
    try {
        const data = await apiCall("manageEntity", { type, name });
        input.value = "";
        await handleDataRefresh(data.message, { management: true, reports: true });
    } finally {
        setButtonLoading(target, false, originalText);
    }
}

async function handleSaveEntity(target) {
    const li = target.closest(".list-group-item");
    const id = li.dataset.id;
    const type = target.dataset.type;
    const name = li.querySelector(".item-input").value.trim();
    
    if (!name) { 
        showToast("Name cannot be empty.", "warning"); 
        return; 
    }
    
    const originalIcon = target.innerHTML;
    target.innerHTML = '<span class="spinner-border"></span>';
    target.disabled = true;
    
    const status = li.querySelector(".badge").textContent;
    
    try {
        const data = await apiCall("manageEntity", { type, id, name, status });
        li.classList.remove("editing");
        await handleDataRefresh(data.message, { management: true });
    } finally {
        target.innerHTML = originalIcon;
        target.disabled = false;
    }
}

function handleToggleEntityStatus(target) {
    const li = target.closest(".list-group-item");
    const { id } = li.dataset;
    const { type } = target.dataset;
    const name = li.querySelector(".item-name").textContent;
    const currentStatus = li.querySelector(".badge").textContent;
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
    
    showConfirmModal(`Are you sure you want to set "${name}" to ${newStatus}?`, async () => {
        const data = await apiCall("manageEntity", { type, id, name, status: newStatus });
        await handleDataRefresh(data.message, { management: true, dashboard: true });
    });
}

async function handleGenerateReport(target) {
    const reportType = document.getElementById("report-type").value;
    let payload = { reportType };
    
    if (reportType === "task_detail") {
        payload.taskId = document.getElementById("report-task-selector").value;
        if (!payload.taskId) { 
            showToast("Please select a task.", "warning"); 
            return; 
        }
    } else if (reportType === "priority_analysis") {
        // No additional payload needed
    } else {
        payload.startDate = document.getElementById("report-start-date").value;
        payload.endDate = document.getElementById("report-end-date").value;
        payload.assessmentMethod = document.getElementById("report-assessment-method").value;
        if (!payload.startDate || !payload.endDate) { 
            showToast("Please select a date range.", "warning"); 
            return; 
        }
    }
    
    const originalText = target.innerHTML;
    setButtonLoading(target, true, 'Generating...');
    
    try {
        const data = await apiCall("getReportsData", payload);
        data.reportType = reportType;
        renderReport(data);
    } finally {
        setButtonLoading(target, false, originalText);
    }
}

async function handleExportExcel(target) {
    const reportContainer = document.getElementById('report-output-container');
    if (!reportContainer) {
        showToast("No report to export", "warning");
        return;
    }
    
    try {
        setButtonLoading(target, true, 'Exporting...');
        const reportTitle = document.querySelector('.report-main-title')?.textContent || 'Task Report';
        const table = reportContainer.querySelector('table');
        
        if (!table) {
            showToast("No data to export", "warning");
            return;
        }
        
        // Convert table to CSV
        const rows = table.querySelectorAll('tr');
        const csv = [];
        
        for (const row of rows) {
            const rowData = [];
            const cells = row.querySelectorAll('th, td');
            
            for (const cell of cells) {
                rowData.push(`"${cell.textContent.trim().replace(/"/g, '""')}"`);
            }
            
            csv.push(rowData.join(','));
        }
        
        const csvContent = csv.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${reportTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Excel file exported successfully", "success");
    } catch (error) {
        showToast("Failed to export Excel: " + error.message, "danger");
    } finally {
        setButtonLoading(target, false, 'Export Excel');
    }
}

function handleExportJpg() {
    const reportContent = document.getElementById("report-content");
    if (!reportContent) { 
        showToast("No report to export.", "danger"); 
        return; 
    }
    
    showToast("Generating JPG, please wait...", "success");
    reportContent.classList.add("print-view-jpg");
    
    html2canvas(reportContent, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        allowTaint: true
    }).then(canvas => {
        const image = canvas.toDataURL("image/jpeg", 0.9);
        const link = document.createElement("a");
        link.href = image;
        link.download = "Task-Report.jpg";
        link.click();
    }).catch(err => {
        showToast("Failed to generate JPG.", "danger");
        console.error(err);
    }).finally(() => {
        reportContent.classList.remove("print-view-jpg");
    });
}

async function handleExportBranches() {
    try {
        const branches = APP_DATA.branches;
        const csvContent = "Name,Status\n" + 
            branches.map(b => `"${b.name.replace(/"/g, '""')}",${b.status}`).join("\n");
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `branches_export_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Branches exported successfully", "success");
    } catch (error) {
        showToast("Failed to export branches: " + error.message, "danger");
    }
}

async function handleExportSections() {
    try {
        const sections = APP_DATA.sections;
        const csvContent = "Name,Status\n" + 
            sections.map(s => `"${s.name.replace(/"/g, '""')}",${s.status}`).join("\n");
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `sections_export_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Sections exported successfully", "success");
    } catch (error) {
        showToast("Failed to export sections: " + error.message, "danger");
    }
}

function handleBulkActions() {
    showConfirmModal("What bulk action would you like to perform?", async () => {
        // Implement bulk actions logic here
        // For example: delete selected tasks, change status, etc.
    });
}

// --- UTILITY FUNCTIONS ---

function showView(viewId) {
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active-view"));
    document.getElementById(`${viewId}-view`).classList.add("active-view");
    document.querySelectorAll("#sidebar .nav-link").forEach(link => {
        link.classList.toggle("active", link.dataset.view === viewId);
    });
    
    // Refresh calendar when its view is shown
    if (viewId === 'calendar' && CALENDAR) {
        refreshCalendar();
    }
}

function toggleDeadline() {
    const type = document.getElementById("task-type").value;
    const container = document.getElementById("deadline-container");
    container.style.display = type === "Time-Limited" ? "block" : "none";
    document.getElementById("task-deadline").required = type === "Time-Limited";
}

function toggleReportOptions() {
    const reportType = document.getElementById("report-type").value;
    document.getElementById("report-task-selector-container").style.display = 
        reportType === "task_detail" ? "block" : "none";
    document.getElementById("report-branch-options-container").style.display = 
        reportType === "branch_performance" ? "flex" : "none";
    document.getElementById("report-assessment-container").style.display = 
        reportType === "branch_performance" ? "block" : "none";
}

function toggleEditEntity(btn, isEditing) {
    const li = btn.closest(".list-group-item");
    if (isEditing) {
        li.classList.add("editing");
        li.querySelector(".item-input").focus();
    } else {
        li.classList.remove("editing");
        const originalName = li.querySelector('.item-name').textContent;
        li.querySelector('.item-input').value = originalName;
    }
}

function showToast(message, type = "success") {
    const toastContainer = document.querySelector(".toast-container");
    const toastId = "toast-" + Date.now();
    const bgClass = type === "danger" ? "bg-danger" : 
                   (type === "warning" ? "bg-warning text-dark" : "bg-success");
    
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>`;
    
    toastContainer.insertAdjacentHTML("beforeend", toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
    toast.show();
    
    toastElement.addEventListener("hidden.bs.toast", () => {
        document.body.removeChild(toastElement);
    });
}

function showConfirmModal(bodyText, onConfirm) {
    document.getElementById("confirm-modal-body").textContent = bodyText;
    confirmCallback = onConfirm;
    confirmModal.show();
}

function setButtonLoading(button, isLoading, loadingText = 'Saving...') {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${loadingText}`;
    } else {
        button.disabled = false;
        button.innerHTML = loadingText;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);