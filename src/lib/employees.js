// Returns true for rows that represent people being checked (not cabinet/auth users).
// Any employee row with auth_user_id set is a cabinet user and must not appear in checked lists.
export const isCheckedEmployee = (employee) => !employee.auth_user_id;
