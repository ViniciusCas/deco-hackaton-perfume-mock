import { createContext } from "react";

export interface AccountContextValue {
  name: string;
}

const Account = createContext<AccountContextValue>({
  name: "sillage",
});

export default Account;
