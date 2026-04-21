export type AddMemberActionState =
  | { status: "idle" }
  | {
      status: "success";
      membership: { userId: string; email: string; name: string; role: string };
    }
  | { status: "error"; error: string };

export const INITIAL_ADD_MEMBER_STATE: AddMemberActionState = {
  status: "idle",
};
