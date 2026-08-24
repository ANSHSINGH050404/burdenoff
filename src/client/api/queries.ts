const userFields = 'id name email role';
const ticketFields = `id title description priority status createdAt firstResponseAt resolvedAt reporter { ${userFields} } assignee { ${userFields} } comments { id content createdAt author { ${userFields} } } resolutionAttempts { id dueAt startedAt resolvedAt state remainingBusinessMinutes } events { id type createdAt body actor { ${userFields} } fromStatus toStatus fromAssignee { ${userFields} } toAssignee { ${userFields} } } sla { firstResponseDueAt resolutionDueAt firstResponseState resolutionState firstResponseRemainingMinutes resolutionRemainingMinutes }`;

export const listQuery = `query Tickets($take: Int, $cursor: String, $status: TicketStatus, $priority: Priority, $assigneeId: ID, $slaState: SLAState) { tickets(take: $take, cursor: $cursor, status: $status, priority: $priority, assigneeId: $assigneeId, slaState: $slaState) { nodes { ${ticketFields} } pageInfo { hasNextPage endCursor } } }`;

export const ticketDetailQuery = `query Ticket($id: ID!) { ticket(id: $id) { ${ticketFields} } }`;

export const dashboardQuery = `query Dashboard { dashboard { total open inProgress resolved closed breached } }`;

export const agentStatsQuery = `query AgentStats { agentStats { agent { ${userFields} } assignedTickets openAssigned resolvedTickets avgFirstResponseBusinessMinutes } }`;

export const usersQuery = `query Users { users { ${userFields} } }`;

export const holidaysQuery = `query Holidays { holidays { id date name } }`;

export const loginMutation = `mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token user { ${userFields} } } }`;

export const registerMutation = `mutation Register($name: String!, $email: String!, $password: String!) { register(name: $name, email: $email, password: $password) { token user { ${userFields} } } }`;

export const createTicketMutation = `mutation Create($title: String!, $description: String!, $priority: Priority!) { createTicket(title: $title, description: $description, priority: $priority) { id } }`;

export const assignMutation = `mutation Assign($ticketId: ID!, $assigneeId: ID!) { assignTicket(ticketId: $ticketId, assigneeId: $assigneeId) { id } }`;

export const statusMutation = `mutation Move($ticketId: ID!, $status: TicketStatus!) { changeTicketStatus(ticketId: $ticketId, status: $status) { id } }`;

export const resolveMutation = `mutation Resolve($ticketId: ID!) { resolveTicket(ticketId: $ticketId) { id } }`;

export const reopenMutation = `mutation Reopen($ticketId: ID!) { reopenTicket(ticketId: $ticketId) { id } }`;

export const commentMutation = `mutation Comment($ticketId: ID!, $content: String!) { addComment(ticketId: $ticketId, content: $content) { id } }`;
