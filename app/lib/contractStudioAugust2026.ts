import type { ContractStudioIntroduction } from "./contractStudioPdf";

/**
 * Historical introductory note from Studio commit e78d24b (2026-08-01).
 * This exact text was also present in 7c7a848. Keep it independent of the
 * current Studio template: older signed agreements must not change when
 * today's introductory note is edited. The restoration caller first checks
 * the August 2026 fingerprint of the recorded clauses and declarations.
 * Return fresh data so a caller cannot mutate this historical template.
 */
export function getAugust2026ContractIntroduction(): ContractStudioIntroduction {
  return {
    paragraphs: [
      'This Seafarer Employment Agreement (the "Agreement") consists of this Introductory Note and four (4) Annexes. Together, the Introductory Note and Annexes A, B, C and D constitute the written agreement between the Seafarer and the Employer in relation to the Seafarer’s employment aboard the Yacht.',
      "The Agreement may be supplemented, in accordance with Annex C, by any Job Description, Yacht Rules, safety procedure, operational policy or other document validly communicated to the Seafarer.",
    ],
    annexes: [
      {
        title: "ANNEX A - PARTIES & YACHT DETAILS",
        text: "Contains the identification and contact details of the Yacht, Seafarer, Employer, Shipowner, Owner and Management Company, as applicable.",
      },
      {
        title: "ANNEX B - EMPLOYMENT TERMS & SPECIAL CONDITIONS",
        text: "Contains the specific terms of employment, including the Seafarer’s position, commencement date, contract duration, trial period where applicable, salary, leave entitlement, rotation, working arrangements, notice period, repatriation destination, governing law, jurisdiction and any Special Conditions agreed between the parties.",
      },
      {
        title: "ANNEX C - GENERAL TERMS & CONDITIONS",
        text: "Contains the general provisions governing the Seafarer’s employment, including duties and Job Description arrangements, Yacht Rules, professional conduct, working and rest hours, wages, leave, medical care, insurance, travel, repatriation, accommodation, confidentiality, safety, complaints, disciplinary matters, termination, governing law and dispute resolution.",
      },
      {
        title: "ANNEX D - DECLARATIONS & SIGNATURES",
        text: "Contains the declarations, acknowledgements and signatures of the Seafarer, Employer and any authorised representative.",
      },
    ],
    closingParagraphs: [
      "The Introductory Note and all Annexes shall be read together as one Agreement. Unless expressly supplemented, varied or replaced by a written Special Condition stated in Annex B, all provisions of Annex C shall apply in full.",
      "Where a Special Condition in Annex B conflicts with a provision of Annex C, the Special Condition shall prevail only to the extent of that specific conflict, subject always to applicable mandatory law, the Yacht’s flag-State requirements and any applicable collective bargaining agreement.",
      "The Seafarer’s applicable Job Description and the Yacht Rules may be communicated separately in accordance with Annex C.",
      "By signing Annex D, the parties confirm their acceptance of the Agreement.",
    ],
    footerNotice: "Generated using BlueDeck.app. BlueDeck.app is not a party to this Agreement and does not provide legal advice.",
  };
}
