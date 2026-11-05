import { TEAM_ROSTER, type TeamRole } from "../shared/roster";
import { daysFromNow } from "../shared/seed";

export interface TeamMemberSeed {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
  avatar: string;
  skills: string[];
  online: boolean;
  color: string;
  region: string;
  hiredAt: Date;
  bio: string;
}

interface TeamDetail {
  phone: string;
  /** pravatar.cc image number, picked to match the member. */
  avatarImage: number;
  skills: string[];
  online: boolean;
  color: string;
  region: string;
  /** Seniority in days, so `hiredAt` stays relative to now. */
  daysSinceHire: number;
  bio: string;
}

const DETAILS = new Map(
  Object.entries({
    "team-01": {
      phone: "+32 470 12 34 01",
      avatarImage: 47,
      skills: ["Management", "Tarification", "Primes"],
      online: true,
      color: "#f59e0b",
      region: "liege",
      daysSinceHire: 3120,
      bio: "Co-fondatrice de Helio. Pilote l'équipe commerciale et la relation avec les partenaires.",
    },
    "team-02": {
      phone: "+32 470 12 34 02",
      avatarImage: 12,
      skills: ["Résidentiel", "Batteries", "Primes"],
      online: true,
      color: "#3b82f6",
      region: "liege",
      daysSinceHire: 1840,
      bio: "Conseiller résidentiel, spécialiste des installations avec batterie.",
    },
    "team-03": {
      phone: "+32 470 12 34 03",
      avatarImage: 45,
      skills: ["Entreprises", "Grands-comptes", "Bornes-VE"],
      online: false,
      color: "#8b5cf6",
      region: "brussels",
      daysSinceHire: 1210,
      bio: "Responsable grands comptes : PME, commerces et parkings d'entreprise.",
    },
    "team-04": {
      phone: "+32 470 12 34 04",
      avatarImage: 13,
      skills: ["Résidentiel", "Entreprises", "Étude-toiture"],
      online: true,
      color: "#10b981",
      region: "namur",
      daysSinceHire: 640,
      bio: "Couvre Namur et le Luxembourg, des maisons quatre façades aux exploitations agricoles.",
    },
    "team-05": {
      phone: "+32 470 12 34 05",
      avatarImage: 15,
      skills: ["Pose-PV", "Onduleurs", "RGIE"],
      online: true,
      color: "#ef4444",
      region: "liege",
      daysSinceHire: 2450,
      bio: "Chef d'équipe pose, référent pour la réception RGIE.",
    },
    "team-06": {
      phone: "+32 470 12 34 06",
      avatarImage: 44,
      skills: ["Batteries", "Onduleurs", "Monitoring"],
      online: false,
      color: "#ec4899",
      region: "liege",
      daysSinceHire: 1330,
      bio: "Technicienne stockage et supervision, mise en service des onduleurs hybrides.",
    },
    "team-07": {
      phone: "+32 470 12 34 07",
      avatarImage: 53,
      skills: ["Pose-PV", "Toiture", "Sécurité"],
      online: true,
      color: "#14b8a6",
      region: "hainaut",
      daysSinceHire: 980,
      bio: "Poseur toiture, formé au travail en hauteur et aux toits plats lestés.",
    },
    "team-08": {
      phone: "+32 470 12 34 08",
      avatarImage: 59,
      skills: ["Bornes-VE", "RGIE"],
      online: false,
      color: "#6366f1",
      region: "brussels",
      daysSinceHire: 720,
      bio: "Électricien spécialisé en bornes de recharge et en tableaux triphasés.",
    },
    "team-09": {
      phone: "+32 470 12 34 09",
      avatarImage: 41,
      skills: ["Entretien", "Monitoring", "Onduleurs"],
      online: true,
      color: "#84cc16",
      region: "namur",
      daysSinceHire: 520,
      bio: "Après-vente : diagnostics à distance, entretien et remplacement d'onduleurs.",
    },
    "team-10": {
      phone: "+32 470 12 34 10",
      avatarImage: 60,
      skills: ["Pose-PV", "Toiture"],
      online: false,
      color: "#f97316",
      region: "luxembourg",
      daysSinceHire: 210,
      bio: "Poseur, a rejoint l'équipe pour couvrir la province de Luxembourg.",
    },
    "team-11": {
      phone: "+32 470 12 34 11",
      avatarImage: 32,
      skills: ["Planification", "Facturation", "Primes"],
      online: true,
      color: "#06b6d4",
      region: "liege",
      daysSinceHire: 1580,
      bio: "Planification des chantiers, facturation et dossiers de primes.",
    },
    "team-12": {
      phone: "+32 470 12 34 12",
      avatarImage: 68,
      skills: ["Achats", "Stock", "Facturation"],
      online: false,
      color: "#a855f7",
      region: "liege",
      daysSinceHire: 860,
      bio: "Achats, gestion du stock et relation fournisseurs.",
    },
  } satisfies Record<string, TeamDetail>),
);

/** Every skill a seeded member has, once each, for the form's suggestions. */
export const SEEDED_SKILLS: readonly string[] = [
  ...new Set([...DETAILS.values()].flatMap((detail) => detail.skills)),
];

/**
 * The members of TEAM_ROSTER with the details a team page shows. Ids, names,
 * e-mails and roles come from the shared roster, which other domains reference;
 * the rest is fixed here so the cards always look the same.
 */
export function buildTeamMembers(): TeamMemberSeed[] {
  return TEAM_ROSTER.map((member) => {
    const detail = DETAILS.get(member.id);
    if (!detail) throw new Error(`No team detail for ${member.id}`);
    return {
      _id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      phone: detail.phone,
      avatar: `https://i.pravatar.cc/240?img=${detail.avatarImage}`,
      skills: detail.skills,
      online: detail.online,
      color: detail.color,
      region: detail.region,
      hiredAt: daysFromNow(-detail.daysSinceHire, 9),
      bio: detail.bio,
    };
  });
}
