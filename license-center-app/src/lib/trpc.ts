import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server-app/src/routers/index";

export const trpc = createTRPCReact<AppRouter>();
