import type { VerifyConfig } from "@antelopejs/tooling-configs/verify";

import { projectJourneys } from "./journeys-project.ts";
import { runJourneys } from "./journeys-run.ts";

const config: VerifyConfig = {
  doors: {
    data: {
      globs: ["providers/antelope_provider.ts", "start/env.ts", ".env.example", ".env.test"],
      funnels: ["providers/antelope_provider.ts"],
      containments: ["runtime/config-mapping"],
      why: "the provider wires the DMS to the MongoDB database `.env` names: a wrong mapping writes the DMS's users, sessions and tenants into another database",
    },
    format: null,
    contract: null,
    outbound: {
      globs: ["providers/antelope_provider.ts"],
      funnels: ["providers/antelope_provider.ts"],
      containments: [],
      why: "the provider configures the mailer (Ethereal by default) and the file storage URL every project inherits; a changed value sends the project's mail through a third party",
    },
    exposure: {
      globs: [".gitignore", ".env.example"],
      funnels: [],
      containments: [],
      why: "every clone inherits what git leaves out; a dropped `.env` line commits the project's secrets, and `.env.example` ships the placeholder secrets users copy",
    },
    publish: null,
  },
  setup: [],
  template: { name: "DMS Adonis", project: true, probe: { path: "/", body: /running/ } },
  journeys: { ...runJourneys, ...projectJourneys },
};

export default config;
