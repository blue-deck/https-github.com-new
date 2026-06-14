export type YachtDepartmentId =
  | "Command"
  | "Deck"
  | "Engineering"
  | "Interior"
  | "Galley"
  | "Purser"
  | "Guest"
  | "Toys"
  | "Safety"
  | "Security"
  | "Medical";

export type YachtPosition = {
  title: string;
  department: YachtDepartmentId;
  rank: number;
  level: "Command" | "Department Head" | "Supervisor" | "Crew" | "Junior";
};

export type ChecklistTemplate = {
  id: string;
  title: string;
  department: YachtDepartmentId;
  type: string;
  frequency: string;
  summary: string;
  tasks: string[];
};

export type ChecklistLibraryPack = {
  id: string;
  title: string;
  subtitle: string;
  focus: string;
  cadence: string;
  templateIds: string[];
};

export const yachtDepartments: YachtDepartmentId[] = [
  "Command",
  "Deck",
  "Engineering",
  "Interior",
  "Galley",
  "Purser",
  "Guest",
  "Toys",
  "Safety",
  "Security",
  "Medical",
];

export const checklistFrequencies = [
  "Template default",
  "Daily",
  "Weekly",
  "Monthly",
  "One-time",
  "Before Departure",
  "After Arrival",
  "Before Guest Arrival",
  "After Guest Departure",
  "Watch",
  "Safety Drill",
  "Season Start",
  "Season End",
];

export const yachtCrewPositions: YachtPosition[] = [
  { title: "Master", department: "Command", rank: 101, level: "Command" },
  { title: "Captain", department: "Command", rank: 100, level: "Command" },
  { title: "Fleet Captain", department: "Command", rank: 98, level: "Command" },
  { title: "Relief Captain", department: "Command", rank: 96, level: "Command" },
  { title: "Staff Captain", department: "Command", rank: 94, level: "Command" },
  { title: "Build Captain", department: "Command", rank: 92, level: "Command" },
  { title: "Chief Officer", department: "Deck", rank: 90, level: "Department Head" },
  { title: "Chief Mate", department: "Deck", rank: 89, level: "Department Head" },
  { title: "First Officer", department: "Deck", rank: 88, level: "Department Head" },
  { title: "First Mate", department: "Deck", rank: 86, level: "Department Head" },
  { title: "Second Officer", department: "Deck", rank: 82, level: "Supervisor" },
  { title: "2nd Officer", department: "Deck", rank: 82, level: "Supervisor" },
  { title: "Third Officer", department: "Deck", rank: 76, level: "Supervisor" },
  { title: "3rd Officer", department: "Deck", rank: 76, level: "Supervisor" },
  { title: "Junior Officer", department: "Deck", rank: 72, level: "Supervisor" },
  { title: "Officer of the Watch", department: "Deck", rank: 74, level: "Supervisor" },
  { title: "Safety Officer", department: "Safety", rank: 74, level: "Supervisor" },
  { title: "Bosun", department: "Deck", rank: 70, level: "Supervisor" },
  { title: "Boatswain", department: "Deck", rank: 70, level: "Supervisor" },
  { title: "Lead Deckhand", department: "Deck", rank: 62, level: "Supervisor" },
  { title: "Senior Deckhand", department: "Deck", rank: 58, level: "Crew" },
  { title: "Tender Driver", department: "Deck", rank: 56, level: "Crew" },
  { title: "Able Seafarer", department: "Deck", rank: 54, level: "Crew" },
  { title: "Carpenter", department: "Deck", rank: 54, level: "Crew" },
  { title: "Paint / Finish Specialist", department: "Deck", rank: 52, level: "Crew" },
  { title: "Deckhand", department: "Deck", rank: 50, level: "Crew" },
  { title: "Junior Deckhand", department: "Deck", rank: 42, level: "Junior" },
  { title: "Dayworker Deckhand", department: "Deck", rank: 36, level: "Junior" },
  { title: "Deck/Stew", department: "Deck", rank: 45, level: "Crew" },

  { title: "Chief Engineer", department: "Engineering", rank: 90, level: "Department Head" },
  { title: "Sole Engineer", department: "Engineering", rank: 78, level: "Department Head" },
  { title: "Second Engineer", department: "Engineering", rank: 76, level: "Supervisor" },
  { title: "2nd Engineer", department: "Engineering", rank: 76, level: "Supervisor" },
  { title: "Third Engineer", department: "Engineering", rank: 68, level: "Supervisor" },
  { title: "3rd Engineer", department: "Engineering", rank: 68, level: "Supervisor" },
  { title: "Engineer", department: "Engineering", rank: 64, level: "Crew" },
  { title: "ETO", department: "Engineering", rank: 72, level: "Supervisor" },
  { title: "AV/IT Officer", department: "Engineering", rank: 66, level: "Crew" },
  { title: "Deck Engineer", department: "Engineering", rank: 62, level: "Crew" },
  { title: "Electrician", department: "Engineering", rank: 60, level: "Crew" },
  { title: "Junior Engineer", department: "Engineering", rank: 50, level: "Junior" },
  { title: "Motorman", department: "Engineering", rank: 44, level: "Junior" },
  { title: "Oiler", department: "Engineering", rank: 42, level: "Junior" },

  { title: "Interior Manager", department: "Interior", rank: 86, level: "Department Head" },
  { title: "Chief Steward/ess", department: "Interior", rank: 82, level: "Department Head" },
  { title: "Chief Stewardess", department: "Interior", rank: 82, level: "Department Head" },
  { title: "Chief Steward", department: "Interior", rank: 82, level: "Department Head" },
  { title: "Sole Steward/ess", department: "Interior", rank: 74, level: "Department Head" },
  { title: "Head of Service", department: "Interior", rank: 72, level: "Supervisor" },
  { title: "Head Housekeeper", department: "Interior", rank: 70, level: "Supervisor" },
  { title: "Second Steward/ess", department: "Interior", rank: 66, level: "Supervisor" },
  { title: "2nd Stewardess", department: "Interior", rank: 66, level: "Supervisor" },
  { title: "Second Stewardess", department: "Interior", rank: 66, level: "Supervisor" },
  { title: "Third Steward/ess", department: "Interior", rank: 60, level: "Crew" },
  { title: "3rd Stewardess", department: "Interior", rank: 60, level: "Crew" },
  { title: "Service Steward/ess", department: "Interior", rank: 56, level: "Crew" },
  { title: "Service Stewardess", department: "Interior", rank: 56, level: "Crew" },
  { title: "Housekeeping Steward/ess", department: "Interior", rank: 54, level: "Crew" },
  { title: "Housekeeping Stewardess", department: "Interior", rank: 54, level: "Crew" },
  { title: "Laundry Steward/ess", department: "Interior", rank: 50, level: "Crew" },
  { title: "Laundry Stewardess", department: "Interior", rank: 50, level: "Crew" },
  { title: "Stewardess", department: "Interior", rank: 50, level: "Crew" },
  { title: "Steward", department: "Interior", rank: 50, level: "Crew" },
  { title: "Junior Steward/ess", department: "Interior", rank: 42, level: "Junior" },
  { title: "Junior Stewardess", department: "Interior", rank: 42, level: "Junior" },
  { title: "Butler", department: "Interior", rank: 58, level: "Crew" },
  { title: "Senior Butler", department: "Interior", rank: 64, level: "Supervisor" },
  { title: "Spa Therapist", department: "Interior", rank: 48, level: "Crew" },
  { title: "Masseuse", department: "Interior", rank: 48, level: "Crew" },
  { title: "Nanny", department: "Interior", rank: 48, level: "Crew" },

  { title: "Executive Chef", department: "Galley", rank: 82, level: "Department Head" },
  { title: "Head Chef", department: "Galley", rank: 78, level: "Department Head" },
  { title: "Chef", department: "Galley", rank: 74, level: "Department Head" },
  { title: "Sole Chef", department: "Galley", rank: 72, level: "Department Head" },
  { title: "Sous Chef", department: "Galley", rank: 64, level: "Supervisor" },
  { title: "Pastry Chef", department: "Galley", rank: 60, level: "Crew" },
  { title: "Crew Chef", department: "Galley", rank: 58, level: "Crew" },
  { title: "Cook/Stew", department: "Galley", rank: 48, level: "Crew" },
  { title: "Galley Hand", department: "Galley", rank: 40, level: "Junior" },

  { title: "Chief Purser", department: "Purser", rank: 88, level: "Department Head" },
  { title: "Purser", department: "Purser", rank: 84, level: "Department Head" },
  { title: "Yacht Administrator", department: "Purser", rank: 68, level: "Supervisor" },
  { title: "Crew Coordinator", department: "Purser", rank: 60, level: "Crew" },

  { title: "Guest Relations Manager", department: "Guest", rank: 72, level: "Supervisor" },
  { title: "Watersports Manager", department: "Toys", rank: 66, level: "Supervisor" },
  { title: "Dive Master", department: "Toys", rank: 58, level: "Crew" },
  { title: "Dive Instructor", department: "Toys", rank: 56, level: "Crew" },
  { title: "Watersports Instructor", department: "Toys", rank: 54, level: "Crew" },
  { title: "Beach Club Attendant", department: "Toys", rank: 44, level: "Junior" },
  { title: "Helicopter Landing Officer", department: "Safety", rank: 68, level: "Supervisor" },
  { title: "Security Officer", department: "Security", rank: 58, level: "Crew" },
  { title: "Medic", department: "Medical", rank: 58, level: "Crew" },
  { title: "Nurse", department: "Medical", rank: 58, level: "Crew" },
  { title: "Owner", department: "Guest", rank: 98, level: "Command" },
  { title: "Yacht Manager", department: "Command", rank: 92, level: "Command" },
];

export const positionSelectGroups = yachtDepartments
  .map((department) => ({
    department,
    positions: yachtCrewPositions
      .filter((position) => position.department === department)
      .map((position) => position.title),
  }))
  .filter((group) => group.positions.length > 0);

export const yachtPositionTitles = yachtCrewPositions.map((position) => position.title);

export function getPosition(title?: string | null) {
  const normalized = normalizePosition(title);
  return yachtCrewPositions.find((position) => normalizePosition(position.title) === normalized);
}

export function getDepartmentByPosition(title?: string | null): YachtDepartmentId {
  return getPosition(title)?.department || "Deck";
}

export function getDefaultPositionForAccountType(role?: string) {
  if (role === "captain") return "Captain";
  if (role === "owner") return "Owner";
  if (role === "management") return "Yacht Manager";
  return "";
}

export function isCaptainLevel(position?: string | null, accountRole?: string | null) {
  const role = (accountRole || "").toLowerCase();
  if (role === "captain" || role === "management" || role === "owner") return true;
  const normalized = normalizePosition(position);
  return ["master", "captain", "fleet captain", "relief captain", "staff captain", "build captain", "owner", "yacht manager"].includes(normalized);
}

export function canAssignToCrew(
  assignerPosition?: string | null,
  assignerDepartment?: string | null,
  targetPosition?: string | null,
  targetDepartment?: string | null,
  accountRole?: string | null
) {
  if (isCaptainLevel(assignerPosition, accountRole)) return true;

  const assigner = getPosition(assignerPosition);
  const target = getPosition(targetPosition);
  if (!assigner || !target) return false;
  if (assigner.rank <= target.rank) return false;

  const allowedDepartments = getAssignableDepartments(assigner.title, assignerDepartment);
  const targetDept = (targetDepartment as YachtDepartmentId) || target.department;
  return allowedDepartments.includes(targetDept);
}

export function canAssignChecklistDepartment(
  assignerPosition?: string | null,
  assignerDepartment?: string | null,
  checklistDepartment?: string | null,
  accountRole?: string | null
) {
  if (isCaptainLevel(assignerPosition, accountRole)) return true;
  if (!checklistDepartment) return false;
  const allowedDepartments = getAssignableDepartments(assignerPosition, assignerDepartment);
  return allowedDepartments.includes(checklistDepartment as YachtDepartmentId);
}

export function getAssignableDepartments(
  assignerPosition?: string | null,
  assignerDepartment?: string | null
): YachtDepartmentId[] {
  const position = normalizePosition(assignerPosition);
  if (["chief officer", "chief mate", "first officer", "first mate", "second officer", "2nd officer", "officer of the watch", "junior officer"].includes(position)) {
    return ["Deck", "Toys", "Safety", "Security"];
  }
  if (["safety officer", "helicopter landing officer"].includes(position)) return ["Safety", "Security", "Medical"];
  if (["bosun", "boatswain", "lead deckhand"].includes(position)) return ["Deck", "Toys"];
  if (["chief engineer", "sole engineer", "second engineer", "2nd engineer", "eto"].includes(position)) return ["Engineering", "Safety"];
  if (["interior manager", "chief steward/ess", "chief stewardess", "chief steward", "sole steward/ess", "head of service", "head housekeeper", "second steward/ess", "second stewardess", "2nd stewardess"].includes(position)) {
    return ["Interior", "Guest", "Medical"];
  }
  if (["executive chef", "head chef", "chef", "sole chef", "sous chef"].includes(position)) return ["Galley"];
  if (["chief purser", "purser", "yacht administrator"].includes(position)) return ["Purser", "Guest"];
  if (["guest relations manager"].includes(position)) return ["Guest", "Interior"];
  if (["watersports manager", "dive master", "dive instructor"].includes(position)) return ["Toys", "Safety"];
  const fallback = yachtDepartments.find((department) => department === assignerDepartment);
  return fallback ? [fallback] : [];
}

export function normalizePosition(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export const checklistTemplates: ChecklistTemplate[] = [
  {
    id: "bridge-passage-plan-review",
    title: "Passage Plan Review",
    department: "Command",
    type: "Navigation",
    frequency: "Before Departure",
    summary: "Bridge team verifies the route, hazards, weather and port requirements before departure.",
    tasks: [
      "Route entered and cross-checked on ECDIS or plotter",
      "Paper or backup navigation plan available",
      "No-go areas, UKC and abort points reviewed",
      "Weather, tides and currents reviewed",
      "Pilotage plan and berth details confirmed",
      "Bridge team briefing completed",
      "Night orders or master's instructions updated",
      "Passage plan signed or approved by officer in charge",
    ],
  },
  {
    id: "bridge-pre-departure-setup",
    title: "Pre-Departure Bridge Setup",
    department: "Command",
    type: "Departure",
    frequency: "Before Departure",
    summary: "Final bridge checks before lines are let go.",
    tasks: [
      "Navigation lights and shapes ready",
      "Radars, AIS, VHF and GPS checked",
      "Handheld radios issued to deck team",
      "Steering and thruster controls tested",
      "Horn and sound signals tested",
      "Engine control station confirmed",
      "Departure time logged",
      "Captain, engineer and deck team communication confirmed",
    ],
  },
  {
    id: "bridge-arrival-port-entry",
    title: "Arrival and Port Entry",
    department: "Command",
    type: "Arrival",
    frequency: "After Arrival",
    summary: "Bridge arrival routine for port entry, anchorage or marina approach.",
    tasks: [
      "ETA confirmed with marina, agent or pilot",
      "Berth, fender side and mooring plan briefed",
      "Speed limits and local notices reviewed",
      "Deck team called to stations",
      "Engine room and thrusters ready for maneuvering",
      "Guest movement restricted during approach",
      "Arrival time and position logged",
    ],
  },
  {
    id: "bridge-watch-handover",
    title: "Bridge Watch Handover",
    department: "Command",
    type: "Watchkeeping",
    frequency: "Watch",
    summary: "Officer handover for safe navigation and watch continuity.",
    tasks: [
      "Current position, course and speed confirmed",
      "Traffic, CPA and navigational risks reviewed",
      "Weather and sea state handed over",
      "Standing orders and night orders read",
      "Alarms, equipment and autopilot status reviewed",
      "Next waypoint and watch priorities confirmed",
    ],
  },
  {
    id: "bridge-noon-report",
    title: "Noon Report and Logbook",
    department: "Command",
    type: "Administration",
    frequency: "Daily",
    summary: "Daily command record for position, voyage, fuel and operational notes.",
    tasks: [
      "Noon position and distance logged",
      "Fuel, water and generator hours collected",
      "Weather and sea condition entered",
      "Defects or incidents recorded",
      "Crew movements and drills recorded",
      "Report shared with captain or management as required",
    ],
  },
  {
    id: "command-daily-operations-brief",
    title: "Daily Captain Operations Brief",
    department: "Command",
    type: "Command Brief",
    frequency: "Daily",
    summary: "Captain-level daily alignment across deck, engineering, interior, guest movement and safety priorities.",
    tasks: [
      "Weather, anchorage or marina conditions reviewed",
      "Guest or owner plan confirmed with department heads",
      "Engineering readiness and defects reviewed",
      "Deck, tender and toys operations briefed",
      "Interior service and cabin priorities confirmed",
      "Safety, security and access risks reviewed",
      "Crew duty rotation and rest considerations checked",
      "Critical notes shared with the onboard team",
    ],
  },
  {
    id: "deck-departure-preparation",
    title: "Departure Preparation",
    department: "Deck",
    type: "Departure",
    frequency: "Before Departure",
    summary: "Deck team prepares exterior, mooring gear and guest areas for departure.",
    tasks: [
      "Fenders ready for release or repositioning",
      "Mooring lines checked and clear to run",
      "Tender, toys and loose deck gear secured",
      "Passerelle and gangway ready to recover",
      "Decks clear of trip hazards",
      "Navigation lights visually checked",
      "Guest exterior areas secured",
      "Deck team radios tested",
    ],
  },
  {
    id: "deck-charter-turnaround-exterior",
    title: "Charter Turnaround Exterior",
    department: "Deck",
    type: "Charter Turnaround",
    frequency: "After Guest Departure",
    summary: "Fast, detailed exterior reset between guest trips without losing safety control.",
    tasks: [
      "Exterior decks washed, dried and inspected",
      "Cushions, covers and guest deck furniture reset",
      "Tender, toys and beach club rinsed and stowed",
      "Fenders, lines and passerelle cleaned and checked",
      "Guest marks, stains or damage photographed and reported",
      "Fuel, water and shore services status confirmed",
      "Deck consumables restocked",
      "Final bosun or officer exterior walk-through completed",
    ],
  },
  {
    id: "deck-arrival-mooring",
    title: "Arrival Mooring Setup",
    department: "Deck",
    type: "Arrival",
    frequency: "After Arrival",
    summary: "Deck team prepares safe mooring, fenders, passerelle and shore services.",
    tasks: [
      "Fender plan set by side and berth",
      "Mooring lines prepared and flaked",
      "Heaving lines ready if required",
      "Passerelle or gangway ready",
      "Shore power cable staged safely",
      "Water hose ready and capped",
      "Deck crew positioned and briefed",
      "Final lines checked after settling",
    ],
  },
  {
    id: "deck-anchor-operations",
    title: "Anchoring Operations",
    department: "Deck",
    type: "Anchoring",
    frequency: "One-time",
    summary: "Deck and bridge coordination for anchoring and anchor recovery.",
    tasks: [
      "Anchor windlass tested",
      "Anchor wash and chain counter checked",
      "Foredeck PPE worn",
      "Anchor party radio check completed",
      "Anchor ball or light ready",
      "Chain marks monitored and reported",
      "Snubber or bridle rigged if required",
      "Anchor secured after recovery",
    ],
  },
  {
    id: "deck-exterior-morning-washdown",
    title: "Exterior Morning Washdown",
    department: "Deck",
    type: "Exterior",
    frequency: "Daily",
    summary: "Daily exterior standard for guest-ready decks.",
    tasks: [
      "Teak rinsed and squeegeed",
      "Stainless wiped and checked",
      "Glass and rails cleaned",
      "Aft deck and side decks washed",
      "Sun pads, cushions and covers checked",
      "Tender garage or beach club tidied",
      "Salt and black streaks removed",
    ],
  },
  {
    id: "deck-tender-safety",
    title: "Tender Launch and Recovery",
    department: "Deck",
    type: "Tender",
    frequency: "One-time",
    summary: "Safe launch, operation and recovery of tenders.",
    tasks: [
      "Tender fuel and battery checked",
      "Kill cord, lifejackets and handheld radio onboard",
      "Navigation lights and horn checked",
      "Guest boarding plan briefed",
      "Painter and lifting points inspected",
      "Tender log updated",
      "Tender rinsed and secured after use",
    ],
  },
  {
    id: "deck-weekly-gear-inventory",
    title: "Deck Gear and Mooring Inventory",
    department: "Deck",
    type: "Inventory",
    frequency: "Weekly",
    summary: "Weekly control of deck gear, lines, fenders and exterior consumables.",
    tasks: [
      "Mooring lines inspected for wear",
      "Fenders checked for pressure and covers",
      "Shackles, strops and hooks inspected",
      "Cleaning products and chamois stock checked",
      "Paint, varnish and teak products reviewed",
      "Defects added to maintenance list",
    ],
  },
  {
    id: "deck-night-secure-round",
    title: "Deck Night Secure Round",
    department: "Deck",
    type: "Night Round",
    frequency: "Daily",
    summary: "Final exterior walk-through before night mode, anchor watch or alongside security.",
    tasks: [
      "Fenders, lines and passerelle checked",
      "Exterior cushions, covers and loose gear secured",
      "Tender, toys and lifting points checked",
      "Anchor light or deck lighting confirmed",
      "Guest deck areas clear and safe",
      "Weather exposure risks reviewed",
      "Night watch or security notes handed over",
    ],
  },
  {
    id: "engineering-engine-room-round",
    title: "Engine Room Daily Round",
    department: "Engineering",
    type: "Engineering",
    frequency: "Daily",
    summary: "Daily machinery space inspection for safe operation.",
    tasks: [
      "Main engine oil and coolant levels checked",
      "Generator oil, coolant and load checked",
      "Bilges checked for water, oil or smell",
      "Seawater strainers inspected",
      "Fuel, lube oil and hydraulic leaks checked",
      "Engine room temperature and ventilation checked",
      "Alarm panel reviewed",
      "Readings recorded in engineering log",
    ],
  },
  {
    id: "engineering-pre-departure-machinery",
    title: "Pre-Departure Machinery Readiness",
    department: "Engineering",
    type: "Departure",
    frequency: "Before Departure",
    summary: "Engineer verifies machinery, hotel loads and maneuvering support before the yacht moves.",
    tasks: [
      "Main engines and generators visually inspected",
      "Oil, coolant, fuel and hydraulic levels confirmed",
      "Bilges checked clean and dry",
      "Steering gear, thrusters and stabilizers ready",
      "Engine room ventilation and alarms checked",
      "Shore power disconnection plan confirmed",
      "Engineer-to-bridge communication tested",
      "Departure readiness reported to captain",
    ],
  },
  {
    id: "engineering-generator-watch",
    title: "Generator Watch",
    department: "Engineering",
    type: "Watchkeeping",
    frequency: "Watch",
    summary: "Generator and load monitoring during operations.",
    tasks: [
      "Generator load within normal limits",
      "Exhaust water flow checked",
      "Oil pressure and temperature checked",
      "Abnormal noise or vibration checked",
      "Switchboard and shore power status checked",
      "Fuel day tank level confirmed",
    ],
  },
  {
    id: "engineering-watermaker",
    title: "Watermaker Operation",
    department: "Engineering",
    type: "Water Systems",
    frequency: "Daily",
    summary: "Fresh water production, quality and system care.",
    tasks: [
      "Pre-filters checked",
      "Operating pressure recorded",
      "Product water quality checked",
      "Fresh water tank levels reviewed",
      "Leaks and abnormal vibration checked",
      "Flush cycle completed when required",
      "Production logged",
    ],
  },
  {
    id: "engineering-hvac-guest-comfort",
    title: "HVAC and Guest Comfort",
    department: "Engineering",
    type: "Hotel Systems",
    frequency: "Daily",
    summary: "Air conditioning and hotel comfort checks.",
    tasks: [
      "Guest area temperatures checked",
      "Chiller status and pressures reviewed",
      "Air handler alarms checked",
      "Blocked drains or leaks checked",
      "Owner and VIP cabin comfort confirmed",
      "Defects reported to interior team",
    ],
  },
  {
    id: "engineering-bunkering",
    title: "Fuel Bunkering Control",
    department: "Engineering",
    type: "Bunkering",
    frequency: "One-time",
    summary: "Fuel transfer checklist for safety and pollution prevention.",
    tasks: [
      "Bunker plan and quantities confirmed",
      "SOPEP spill kit positioned",
      "Scuppers plugged where required",
      "Tank sounding or gauges verified",
      "Communication with supplier established",
      "Transfer watched continuously",
      "Final quantities and samples recorded",
    ],
  },
  {
    id: "engineering-weekly-planned-maintenance",
    title: "Weekly Planned Maintenance Review",
    department: "Engineering",
    type: "Maintenance",
    frequency: "Weekly",
    summary: "Engineering PMS and defect review.",
    tasks: [
      "Open maintenance jobs reviewed",
      "Critical spares checked",
      "Filters and belts status checked",
      "Safety critical equipment tasks verified",
      "Contractor work permits reviewed",
      "Captain updated on defects and downtime",
    ],
  },
  {
    id: "engineering-bilge-leak-control",
    title: "Bilge and Leak Control",
    department: "Engineering",
    type: "Machinery Space",
    frequency: "Daily",
    summary: "Focused inspection for bilges, leaks, smells and pollution risk before they become operational issues.",
    tasks: [
      "Engine room bilges checked clean and dry",
      "Forward and aft bilge alarms tested or reviewed",
      "Fuel, oil, coolant and hydraulic leaks checked",
      "Stern gland, shaft seals and sea valves inspected",
      "Grey and black water alarms reviewed",
      "Any abnormal smell, sheen or water ingress reported",
    ],
  },
  {
    id: "interior-guest-arrival-suites",
    title: "Guest Arrival Suite Setup",
    department: "Interior",
    type: "Guest Arrival",
    frequency: "Before Guest Arrival",
    summary: "Guest cabins and bathrooms prepared to arrival standard.",
    tasks: [
      "Beds made to yacht standard",
      "Bathrooms sanitized and detailed",
      "Amenities and guest preferences placed",
      "Wardrobes, drawers and safe checked",
      "Flowers, welcome notes or gifts placed",
      "Cabin temperature and lighting checked",
      "Laundry bags and towels ready",
      "Final chief stew inspection completed",
    ],
  },
  {
    id: "interior-charter-turnaround",
    title: "Interior Charter Turnaround",
    department: "Interior",
    type: "Charter Turnaround",
    frequency: "After Guest Departure",
    summary: "Interior reset after guest departure with guest-ready inspection discipline.",
    tasks: [
      "Guest cabins stripped, cleaned and reset",
      "Bathrooms sanitized and amenities restocked",
      "Guest laundry, lost property and owner items logged",
      "Saloon, dining and service areas detailed",
      "Minibars, flowers and guest preferences refreshed",
      "Damage, stains or maintenance issues photographed",
      "Linen and towel inventory checked",
      "Chief stew final inspection completed",
    ],
  },
  {
    id: "interior-daily-cabin-service",
    title: "Daily Cabin Service",
    department: "Interior",
    type: "Housekeeping",
    frequency: "Daily",
    summary: "Daily housekeeping routine for guest cabins.",
    tasks: [
      "Beds refreshed",
      "Bathrooms cleaned and dried",
      "Bins emptied",
      "Towels replaced as required",
      "Laundry collected and logged",
      "Surfaces dusted and polished",
      "Minibar or amenities replenished",
    ],
  },
  {
    id: "interior-evening-turndown",
    title: "Evening Turndown",
    department: "Interior",
    type: "Housekeeping",
    frequency: "Daily",
    summary: "Evening guest cabin reset.",
    tasks: [
      "Beds turned down",
      "Bathroom evening refresh completed",
      "Water, glasses and amenities placed",
      "Lighting and curtains set",
      "Laundry returned where ready",
      "Guest personal items respected and aligned",
    ],
  },
  {
    id: "interior-table-service",
    title: "Table Service Setup",
    department: "Interior",
    type: "Service",
    frequency: "Before Guest Arrival",
    summary: "Formal or casual meal service setup.",
    tasks: [
      "Table plan confirmed with chief stew and chef",
      "Linen, placemats or setting style prepared",
      "Cutlery polished and placed",
      "Glassware polished and checked",
      "Napkins folded and aligned",
      "Drinks station ready",
      "Dietary notes reviewed before service",
    ],
  },
  {
    id: "interior-laundry-flow",
    title: "Laundry Flow Control",
    department: "Interior",
    type: "Laundry",
    frequency: "Daily",
    summary: "Guest, crew and yacht linen laundry control.",
    tasks: [
      "Guest laundry logged and separated",
      "Crew laundry schedule followed",
      "Delicates and special care items checked",
      "Linen inventory monitored",
      "Ironing and folding quality checked",
      "Returned laundry matched to cabins",
    ],
  },
  {
    id: "interior-crew-areas",
    title: "Crew Mess and Crew Areas",
    department: "Interior",
    type: "Crew Areas",
    frequency: "Daily",
    summary: "Crew area hygiene and readiness.",
    tasks: [
      "Crew mess cleaned",
      "Coffee station and water station replenished",
      "Crew heads cleaned",
      "Bins emptied",
      "Crew fridge checked",
      "Notice board or duty list updated",
    ],
  },
  {
    id: "interior-guest-departure-reset",
    title: "Guest Departure Reset",
    department: "Interior",
    type: "Guest Departure",
    frequency: "After Guest Departure",
    summary: "Controlled guest departure flow for lost property, cabin reset, laundry and damage reporting.",
    tasks: [
      "Guest luggage, personal items and lost property checked",
      "Cabins stripped and laundry separated",
      "Bathroom amenities and yacht stock counted",
      "Guest damage, stains or repairs photographed",
      "Cabin safe, drawers and wardrobes cleared",
      "Chief stew departure inspection completed",
    ],
  },
  {
    id: "galley-opening",
    title: "Galley Opening",
    department: "Galley",
    type: "Food Safety",
    frequency: "Daily",
    summary: "Chef opens the galley safely for the day.",
    tasks: [
      "Fridge and freezer temperatures recorded",
      "Hand wash and sanitizer stations stocked",
      "Surfaces sanitized",
      "Daily menus and dietary notes reviewed",
      "Provision levels checked",
      "Waste and recycling plan set",
      "Galley ventilation checked",
    ],
  },
  {
    id: "galley-guest-meal-prep",
    title: "Guest Meal Service Prep",
    department: "Galley",
    type: "Guest Service",
    frequency: "Daily",
    summary: "Meal preparation coordination with service team.",
    tasks: [
      "Menu confirmed with captain or chief stew",
      "Guest allergies and preferences checked",
      "Service time confirmed",
      "Mise en place completed",
      "Plate presentation plan reviewed",
      "Service call timing agreed",
    ],
  },
  {
    id: "galley-provision-receiving",
    title: "Provision Receiving",
    department: "Galley",
    type: "Provisioning",
    frequency: "One-time",
    summary: "Safe receipt and storage of provisions.",
    tasks: [
      "Delivery checked against order",
      "Cold chain verified",
      "Quality and expiry dates inspected",
      "Dry goods stored and labelled",
      "Fresh produce washed or separated as required",
      "Invoices or receipts passed to purser",
    ],
  },
  {
    id: "galley-closing",
    title: "Galley Closing",
    department: "Galley",
    type: "Food Safety",
    frequency: "Daily",
    summary: "End of day galley hygiene and safety.",
    tasks: [
      "Cooking equipment shut down",
      "Surfaces and floors cleaned",
      "Waste removed",
      "Fridges closed and temperatures checked",
      "Knives and equipment secured",
      "Next day prep labelled",
    ],
  },
  {
    id: "galley-food-safety-temperature-log",
    title: "Food Safety Temperature Log",
    department: "Galley",
    type: "Food Safety",
    frequency: "Daily",
    summary: "Temperature, labelling and hygiene control for guest and crew food safety.",
    tasks: [
      "Fridge and freezer temperatures recorded",
      "Hot holding and cooling records checked where used",
      "Opened items labelled and dated",
      "Expired or high-risk food removed",
      "Allergy and dietary notes reviewed",
      "Sanitizer and hand wash stations stocked",
    ],
  },
  {
    id: "purser-crew-documents",
    title: "Crew Documents and Expiry Review",
    department: "Purser",
    type: "Compliance",
    frequency: "Weekly",
    summary: "Crew certification, passport, visa and medical expiry control.",
    tasks: [
      "Passport and seaman book expiries reviewed",
      "Visas and flag endorsements checked",
      "STCW and medical certificates reviewed",
      "Crew list updated",
      "Upcoming expiry alerts sent",
      "Captain notified of any critical document risk",
    ],
  },
  {
    id: "purser-apa-cash-log",
    title: "APA, Cash and Receipt Log",
    department: "Purser",
    type: "Finance",
    frequency: "Weekly",
    summary: "Financial housekeeping for guest or yacht operations.",
    tasks: [
      "Cash balance counted",
      "Receipts matched to expenses",
      "Guest APA entries updated",
      "Crew purchase claims reviewed",
      "Supplier invoices filed",
      "Captain or management report prepared",
    ],
  },
  {
    id: "purser-guest-preferences",
    title: "Guest Preference Profile",
    department: "Purser",
    type: "Guest Administration",
    frequency: "Before Guest Arrival",
    summary: "Preference sheet and guest data readiness.",
    tasks: [
      "Guest names and cabin allocation confirmed",
      "Dietary requirements verified",
      "Service preferences shared with interior",
      "Activity preferences shared with deck and toys",
      "Privacy and security requirements reviewed",
      "Guest documents stored securely",
    ],
  },
  {
    id: "safety-weekly-lsa-ffe",
    title: "Weekly LSA and FFE Check",
    department: "Safety",
    type: "Safety Equipment",
    frequency: "Weekly",
    summary: "Life-saving and fire-fighting equipment inspection.",
    tasks: [
      "Fire extinguishers visually checked",
      "Fire doors and escape routes clear",
      "Lifejackets and immersion suits checked",
      "Liferaft hydrostatic release dates reviewed",
      "EPIRB and SART status checked",
      "MOB equipment checked",
      "Defects recorded in SMS or defect log",
    ],
  },
  {
    id: "safety-drill-preparation",
    title: "Muster and Drill Preparation",
    department: "Safety",
    type: "Drill",
    frequency: "Safety Drill",
    summary: "Prepare, brief and record yacht drills.",
    tasks: [
      "Drill scenario selected",
      "Crew muster list checked",
      "Radios and emergency roles assigned",
      "Guests or owner informed if required",
      "Drill completed safely",
      "Debrief notes recorded",
      "Corrective actions assigned",
    ],
  },
  {
    id: "safety-guest-safety-briefing",
    title: "Guest Safety Briefing",
    department: "Safety",
    type: "Guest Safety",
    frequency: "Before Guest Arrival",
    summary: "Guest-facing safety briefing and emergency readiness confirmation.",
    tasks: [
      "Lifejacket locations and emergency signals prepared",
      "Muster point and basic emergency route reviewed",
      "Tender transfer and swim platform safety briefed",
      "Watersports rules and local restrictions explained",
      "Smoking, fire and galley access rules confirmed",
      "Medical concerns or allergies shared with relevant crew",
      "Guest count and cabin allocation confirmed",
      "Captain or chief officer briefing completed",
    ],
  },
  {
    id: "safety-pollution-prevention",
    title: "Pollution Prevention Round",
    department: "Safety",
    type: "MARPOL",
    frequency: "Weekly",
    summary: "Pollution prevention checks around deck, engineering and stores.",
    tasks: [
      "Spill kits complete and accessible",
      "Oil absorbents available",
      "Garbage segregation checked",
      "Bilge and oily waste status reviewed",
      "Hazardous products stored correctly",
      "Deck drains and scuppers checked",
      "Any pollution risk reported to captain",
    ],
  },
  {
    id: "safety-abandon-ship-muster",
    title: "Abandon Ship and Muster Drill",
    department: "Safety",
    type: "Drill",
    frequency: "Safety Drill",
    summary: "Crew readiness check for alarms, muster roles, lifesaving appliances and guest control.",
    tasks: [
      "Alarm signal and muster list reviewed",
      "Crew emergency roles assigned and confirmed",
      "Lifejackets, immersion suits and grab bags checked",
      "Liferaft launch points and embarkation routes reviewed",
      "Guest control and head count procedure briefed",
      "Drill debrief and corrective actions recorded",
    ],
  },
  {
    id: "safety-hot-work-permit",
    title: "Hot Work Permit Control",
    department: "Safety",
    type: "Permit to Work",
    frequency: "One-time",
    summary: "Control welding, grinding and hot work onboard.",
    tasks: [
      "Work scope and location approved",
      "Area cleared of flammables",
      "Fire watch assigned",
      "Extinguishers and hose ready",
      "Ventilation confirmed",
      "Permit signed before work starts",
      "Area monitored after completion",
    ],
  },
  {
    id: "toys-beach-club-setup",
    title: "Beach Club Setup",
    department: "Toys",
    type: "Guest Toys",
    frequency: "Before Guest Arrival",
    summary: "Guest-ready beach club and watersports setup.",
    tasks: [
      "Beach club deck washed and dried",
      "Towels, water and sunscreen ready",
      "Shade, mats and lounging area set",
      "Lifejackets and safety gear staged",
      "Tender or rescue craft on standby",
      "Guest briefing area prepared",
      "Toys launch order confirmed",
    ],
  },
  {
    id: "toys-jetski-prep",
    title: "Jetski Preparation",
    department: "Toys",
    type: "Guest Toys",
    frequency: "Daily",
    summary: "Jetski readiness and safety control.",
    tasks: [
      "Fuel level checked",
      "Battery and start test completed",
      "Kill cord checked",
      "Hull and intake inspected",
      "Registration and local rules confirmed",
      "Guest safety briefing prepared",
      "Fresh water flush completed after use",
    ],
  },
  {
    id: "toys-seabob-prep",
    title: "Seabob and E-Foil Preparation",
    department: "Toys",
    type: "Guest Toys",
    frequency: "Daily",
    summary: "Battery toy readiness and charging discipline.",
    tasks: [
      "Batteries charged and logged",
      "Units inspected for damage",
      "Prop guards and seals checked",
      "Charging area safe and dry",
      "Guest briefing completed",
      "Units rinsed and dried after use",
    ],
  },
  {
    id: "toys-watersports-safety-briefing",
    title: "Watersports Safety Briefing",
    department: "Toys",
    type: "Guest Toys",
    frequency: "Before Guest Arrival",
    summary: "Guest briefing and operating control before toys, seabobs, jetskis, boards or towables are launched.",
    tasks: [
      "Local rules, permits and no-go zones confirmed",
      "Guest ability, age and medical limits checked",
      "Lifejackets and safety equipment issued",
      "Rescue tender or spotter assigned",
      "Hand signals and kill cord rules explained",
      "Post-use rinse, battery and damage check planned",
    ],
  },
  {
    id: "toys-dive-operations",
    title: "Dive Operations",
    department: "Toys",
    type: "Diving",
    frequency: "One-time",
    summary: "Dive guest safety and equipment readiness.",
    tasks: [
      "Guest certifications and medical status checked",
      "Dive plan and site conditions reviewed",
      "Tanks, BCDs and regulators checked",
      "Oxygen kit and first aid ready",
      "Surface watch assigned",
      "Tender support confirmed",
      "Post-dive equipment rinsed and logged",
    ],
  },
  {
    id: "guest-owner-arrival",
    title: "Owner Arrival Ready",
    department: "Guest",
    type: "Owner Experience",
    frequency: "Before Guest Arrival",
    summary: "Final yacht readiness before owner or principal guest arrival.",
    tasks: [
      "Owner cabin inspected",
      "Preferred drinks and amenities placed",
      "Crew uniforms and presentation checked",
      "Music, lighting and temperature set",
      "Welcome drinks and towel service ready",
      "Privacy mode briefed to crew",
      "Captain arrival briefing completed",
    ],
  },
  {
    id: "guest-tender-transfer",
    title: "Guest Tender Transfer",
    department: "Guest",
    type: "Guest Movement",
    frequency: "One-time",
    summary: "Safe and polished guest movement by tender.",
    tasks: [
      "Tender ETA and pickup point confirmed",
      "Guest shoes, bags and towels prepared",
      "Lifejackets available if required",
      "Boarding assistance assigned",
      "Weather and sea state reviewed",
      "Guest count confirmed both ways",
    ],
  },
  {
    id: "guest-charter-welcome-flow",
    title: "Charter Guest Welcome Flow",
    department: "Guest",
    type: "Guest Experience",
    frequency: "Before Guest Arrival",
    summary: "Coordinated arrival routine for first impression, service timing and guest movement.",
    tasks: [
      "Arrival ETA and transfer plan confirmed",
      "Welcome drinks, cold towels and music ready",
      "Cabin allocation and luggage plan briefed",
      "Safety briefing owner or guest timing agreed",
      "Dietary, allergies and preferences shared",
      "Captain, chief stew and deck team aligned",
    ],
  },
  {
    id: "security-night-round",
    title: "Night Security Round",
    department: "Security",
    type: "Security",
    frequency: "Daily",
    summary: "Night security and access control routine.",
    tasks: [
      "Exterior doors and access points checked",
      "Passerelle or gangway watch confirmed",
      "CCTV or alarm panel reviewed",
      "Tender and toys secured",
      "Visitor log reviewed",
      "Suspicious activity reported to officer on watch",
    ],
  },
  {
    id: "security-visitor-access-control",
    title: "Visitor and Contractor Access Control",
    department: "Security",
    type: "Security",
    frequency: "One-time",
    summary: "Controlled access for contractors, suppliers, agents and visitors while protecting guest privacy.",
    tasks: [
      "Visitor or contractor identity confirmed",
      "Work scope, area and escort requirement agreed",
      "Guest privacy zones protected",
      "Tool bags, deliveries or stores logged as required",
      "Departure time and access badges checked",
      "Security or captain notified of any concern",
    ],
  },
  {
    id: "medical-locker-check",
    title: "Medical Locker Check",
    department: "Medical",
    type: "Medical",
    frequency: "Monthly",
    summary: "Medical locker and emergency medical kit control.",
    tasks: [
      "Expiry dates reviewed",
      "Controlled items counted where applicable",
      "Oxygen kit checked",
      "AED status checked",
      "First aid kits restocked",
      "Medical log updated",
      "Captain informed of shortages",
    ],
  },
  {
    id: "medical-guest-readiness",
    title: "Guest Medical Readiness",
    department: "Medical",
    type: "Medical",
    frequency: "Before Guest Arrival",
    summary: "Medical preparation for guests, allergies, medications and emergency response readiness.",
    tasks: [
      "Known allergies and medical notes reviewed",
      "First aid kits and AED checked",
      "Seasickness and minor care supplies stocked",
      "Nearest clinic, medevac and emergency contacts reviewed",
      "Chef and service team informed of relevant allergies",
      "Captain briefed on any medical risk",
    ],
  },
  {
    id: "season-start-readiness",
    title: "Season Start Yacht Readiness",
    department: "Command",
    type: "Seasonal",
    frequency: "Season Start",
    summary: "Whole-yacht readiness review before the season opens.",
    tasks: [
      "Crew list and certificates verified",
      "Safety drills scheduled",
      "Critical machinery tested",
      "Guest areas inspected",
      "Tenders, toys and deck gear checked",
      "Provisioning and uniforms reviewed",
      "Open defects prioritized",
      "Captain readiness sign-off completed",
    ],
  },
  {
    id: "season-end-layup",
    title: "Season End Layup",
    department: "Command",
    type: "Seasonal",
    frequency: "Season End",
    summary: "Controlled season-end shutdown and handover.",
    tasks: [
      "Guest and owner items inventoried",
      "Deep clean schedule issued",
      "Maintenance and yard list updated",
      "Toys and tenders winterized as required",
      "Crew travel and leave plan confirmed",
      "Documents, logs and reports archived",
      "Management handover sent",
    ],
  },
];

export const checklistLibraryPacks: ChecklistLibraryPack[] = [
  {
    id: "departure-ready",
    title: "Departure Ready",
    subtitle: "Bridge, deck and machinery checks before the yacht moves.",
    focus: "Command / Deck / Engineering",
    cadence: "Before departure",
    templateIds: [
      "bridge-passage-plan-review",
      "bridge-pre-departure-setup",
      "deck-departure-preparation",
      "engineering-pre-departure-machinery",
      "safety-weekly-lsa-ffe",
    ],
  },
  {
    id: "charter-turnaround",
    title: "Charter Turnaround",
    subtitle: "Fast exterior, interior, galley and guest reset between trips.",
    focus: "Deck / Interior / Galley / Guest",
    cadence: "Guest changeover",
    templateIds: [
      "deck-charter-turnaround-exterior",
      "interior-charter-turnaround",
      "interior-guest-departure-reset",
      "galley-provision-receiving",
      "guest-charter-welcome-flow",
    ],
  },
  {
    id: "daily-yacht-standard",
    title: "Daily Yacht Standard",
    subtitle: "Morning routines, hotel systems, housekeeping and night secure.",
    focus: "Whole yacht",
    cadence: "Daily",
    templateIds: [
      "command-daily-operations-brief",
      "deck-exterior-morning-washdown",
      "engineering-engine-room-round",
      "engineering-bilge-leak-control",
      "interior-daily-cabin-service",
      "galley-opening",
      "deck-night-secure-round",
    ],
  },
  {
    id: "guest-experience",
    title: "Guest Experience",
    subtitle: "Arrival, cabins, service, tenders, toys and owner-ready presentation.",
    focus: "Guest / Interior / Toys",
    cadence: "Guest operations",
    templateIds: [
      "guest-owner-arrival",
      "guest-charter-welcome-flow",
      "interior-guest-arrival-suites",
      "interior-table-service",
      "guest-tender-transfer",
      "toys-beach-club-setup",
    ],
  },
  {
    id: "safety-sms",
    title: "Safety and SMS",
    subtitle: "Drills, firefighting, lifesaving, pollution, medical and permits.",
    focus: "Safety / Medical / Security",
    cadence: "Weekly / drill",
    templateIds: [
      "safety-weekly-lsa-ffe",
      "safety-drill-preparation",
      "safety-abandon-ship-muster",
      "safety-pollution-prevention",
      "safety-hot-work-permit",
      "medical-locker-check",
      "security-visitor-access-control",
    ],
  },
  {
    id: "engineering-control",
    title: "Engineering Control",
    subtitle: "Engine room, generators, watermaker, HVAC, bunkering and PMS.",
    focus: "Engineering",
    cadence: "Daily / weekly",
    templateIds: [
      "engineering-engine-room-round",
      "engineering-pre-departure-machinery",
      "engineering-bilge-leak-control",
      "engineering-generator-watch",
      "engineering-watermaker",
      "engineering-hvac-guest-comfort",
      "engineering-weekly-planned-maintenance",
    ],
  },
  {
    id: "tenders-toys",
    title: "Tenders and Toys",
    subtitle: "Launch, guest briefing, water toys, diving and recovery control.",
    focus: "Deck / Toys / Safety",
    cadence: "Guest activity",
    templateIds: [
      "deck-tender-safety",
      "toys-beach-club-setup",
      "toys-jetski-prep",
      "toys-seabob-prep",
      "toys-watersports-safety-briefing",
      "toys-dive-operations",
    ],
  },
  {
    id: "season-management",
    title: "Season Management",
    subtitle: "Season opening, compliance, APA, documents and layup.",
    focus: "Command / Purser",
    cadence: "Seasonal",
    templateIds: [
      "season-start-readiness",
      "purser-crew-documents",
      "purser-apa-cash-log",
      "purser-guest-preferences",
      "season-end-layup",
    ],
  },
];

export function getChecklistTemplate(id: string) {
  return checklistTemplates.find((template) => template.id === id);
}
