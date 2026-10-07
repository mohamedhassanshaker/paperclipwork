// TODO(TAH-19): replace with the real Auth.js session lookup once
// authentication lands. The app shell needs a signed-in user's email to
// render the sidebar user chip, so this stands in until then.
export function getStubSession() {
  return { userEmail: "admin@company.com" };
}
