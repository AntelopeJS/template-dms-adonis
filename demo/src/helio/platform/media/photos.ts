import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import type { MediaFolderDeclaration } from "@antelopejs/interface-dms-media";
import { buildProjects, type ProjectSeed } from "../../projects/fixtures";
import type { ContractProject } from "./contracts";
import { FOLDER_KEYS } from "./folders";
import type { PhotoKind } from "./scenes";

export interface PhotoPlan {
  key: string;
  folderKey: string;
  name: string;
  alt: string;
  kind: PhotoKind;
  seed: number;
}

/**
 * The site photos filed for one finished project of the demo data: a
 * subfolder named after its code, customer and town, holding the photos a
 * crew takes on such a job (before, during, after, technical room).
 */
export interface PhotoProject {
  project: ProjectSeed;
  folder: MediaFolderDeclaration;
  photos: PhotoPlan[];
  customerName: string;
}

/** How many finished projects of each type get a photo folder. */
const PICKS: ReadonlyArray<readonly [ProjectSeed["type"], number]> = [
  ["residential_pv", 3],
  ["commercial_pv", 1],
  ["battery", 1],
  ["ev_charger", 1],
];

type Shot = readonly [PhotoKind, string, (who: string) => string];

const SHOTS: Record<ProjectSeed["type"], readonly Shot[]> = {
  residential_pv: [
    [
      "house-before",
      "01 - Toiture avant travaux.png",
      (who) => `Toiture de ${who} avant la pose`,
    ],
    [
      "house-during",
      "02 - Pose des rails et des premiers modules.png",
      (who) => `Pose des modules chez ${who}, échafaudage en place`,
    ],
    [
      "house-after",
      "03 - Installation terminée.png",
      (who) => `Installation photovoltaïque terminée chez ${who}`,
    ],
    [
      "technical-room",
      "04 - Onduleur et coffret AC.png",
      (who) => `Onduleur et coffret électrique chez ${who}`,
    ],
  ],
  commercial_pv: [
    [
      "flat-roof",
      "01 - Vue d'ensemble du bâtiment.png",
      (who) => `Toiture plate équipée de ${who}`,
    ],
    [
      "panel-rows",
      "02 - Rangées de modules en toiture.png",
      (who) => `Rangées de modules inclinés sur le toit de ${who}`,
    ],
    [
      "technical-room",
      "03 - Local technique.png",
      (who) => `Local technique de ${who} avec onduleur et tableau`,
    ],
  ],
  battery: [
    [
      "technical-room",
      "01 - Batterie et onduleur hybride.png",
      (who) => `Batterie domestique et onduleur hybride chez ${who}`,
    ],
    [
      "house-after",
      "02 - Vue de la maison.png",
      (who) => `Maison de ${who} avec ses panneaux existants`,
    ],
  ],
  ev_charger: [
    [
      "wallbox",
      "01 - Borne installée.png",
      (who) => `Borne de recharge installée chez ${who}`,
    ],
    [
      "technical-room",
      "02 - Tableau électrique.png",
      (who) => `Tableau électrique adapté pour la borne de ${who}`,
    ],
  ],
};

/** "Installation photovoltaïque 9,5 kWc — Marie Simon" → "Marie Simon". */
function customerOf(project: ProjectSeed): string {
  const parts = project.name.split(" — ");
  return parts[parts.length - 1] ?? project.name;
}

function seedOf(project: ProjectSeed): number {
  return 1000 + Number.parseInt(project._id.replace(/\D/g, ""), 10);
}

function photoProject(project: ProjectSeed): PhotoProject {
  const customerName = customerOf(project);
  const city = project.address.city;
  const folderKey = `${FOLDER_KEYS.photos}.${project._id}`;
  return {
    project,
    customerName,
    folder: {
      tenantId: DEFAULT_TENANT_ID,
      key: folderKey,
      name: `${project.code} - ${customerName}${city ? `, ${city}` : ""}`,
      parent: FOLDER_KEYS.photos,
    },
    photos: SHOTS[project.type].map(([kind, name, alt], index) => ({
      key: `${folderKey}.${index + 1}`,
      folderKey,
      name,
      alt: alt(customerName),
      kind,
      seed: seedOf(project),
    })),
  };
}

/** The projects that get a photo folder, chosen among the finished ones. */
export function photoProjects(): PhotoProject[] {
  const done = buildProjects().filter((p) => p.status === "done");
  return PICKS.flatMap(([type, count]) =>
    done
      .filter((p) => p.type === type)
      .slice(0, count)
      .map(photoProject),
  );
}

/** The contract facts of the photographed solar projects. */
export function contractProjects(
  projects: readonly PhotoProject[],
): ContractProject[] {
  return projects
    .filter(
      ({ project }) =>
        project.type === "commercial_pv" || project.type === "residential_pv",
    )
    .slice(0, 2)
    .map(({ project, customerName }) => ({
      code: project.code,
      customerName,
      city: project.address.city,
      capacityKwp: project.capacityKwp ?? 0,
      budget: project.budget,
    }));
}
