/*
 * Inglés por profesión: vocabulario, temas para hablar y escenarios de conversación.
 * Se mezclan con el contenido general según la profesión elegida en Ajustes.
 */
export const PROFESSIONS = {
  general: { name: "General", en: "everyday life and work", cards: [], topics: [], scenarios: [] },

  contabilidad: {
    name: "Contabilidad y tributos",
    en: "accounting, auditing and taxes",
    cards: [
      ["tax return", "declaración de impuestos", "We filed the tax return before the deadline."],
      ["withholding tax", "retención", "The withholding tax is 8% of the invoice."],
      ["invoice", "factura", "Please send the invoice to our accounts payable team."],
      ["balance sheet", "balance general", "The balance sheet shows our assets and liabilities."],
      ["income statement", "estado de resultados", "Revenue increased in this quarter's income statement."],
      ["accounts receivable", "cuentas por cobrar", "Accounts receivable are too high this month."],
      ["accounts payable", "cuentas por pagar", "We need to reduce accounts payable before year-end."],
      ["audit", "auditoría", "The external audit starts next Monday."],
      ["deductible expense", "gasto deducible", "Is this training a deductible expense?"],
      ["month-end close", "cierre de mes", "The month-end close usually takes three days."],
      ["tax authority", "administración tributaria (SUNAT)", "The tax authority sent us a notice."],
      ["fiscal year", "ejercicio fiscal", "Our fiscal year ends on December 31st."],
    ],
    topics: [
      { t: "Explain your role in the accounting team", h: "I'm in charge of · I reconcile · I report to…" },
      { t: "Describe how your company prepares the month-end close", h: "first we · then · the hardest part is…" },
      { t: "Explain a recent tax change to a foreign client", h: "as of · this means that · you will need to…" },
    ],
    scenarios: [
      { id: "acc_client", name: "Cliente con aviso tributario", role: "Mr. Evans, a foreign client who received a notice from the Peruvian tax authority (SUNAT) and is worried; the learner is his accountant", open: "Hi, thanks for taking my call. I got this letter from the tax authority and I don't understand it. Should I be worried?" },
      { id: "acc_cfo", name: "Cierre de mes con el CFO", role: "Linda, the CFO, reviewing the month-end close results with the learner", open: "Okay, let's go over the month-end numbers. Why did expenses go up so much this month?" },
    ],
  },

  ventas: {
    name: "Ventas y atención al cliente",
    en: "sales and customer service",
    cards: [
      ["lead", "cliente potencial", "We got twenty new leads from the webinar."],
      ["follow up", "dar seguimiento", "I'll follow up with them on Thursday."],
      ["quote", "cotización", "Could you send me a quote for 500 units?"],
      ["discount", "descuento", "We can offer a 10% discount for early payment."],
      ["close a deal", "cerrar una venta", "She closed a big deal yesterday."],
      ["pitch", "presentación de venta", "Keep your pitch under two minutes."],
      ["target", "meta", "We reached our sales target for the quarter."],
      ["complaint", "reclamo", "We handle every complaint within 24 hours."],
      ["refund", "reembolso", "The customer asked for a full refund."],
      ["warranty", "garantía", "The product has a two-year warranty."],
      ["upsell", "venta adicional", "Try to upsell the premium plan."],
      ["pipeline", "embudo de ventas", "Our pipeline looks strong for next month."],
    ],
    topics: [
      { t: "Pitch your favourite product in one minute", h: "it helps you · unlike other · the best part is…" },
      { t: "Describe how you handle an angry customer", h: "first I listen · I apologize for · then I offer…" },
      { t: "Talk about a sale you are proud of", h: "the client needed · I suggested · in the end…" },
    ],
    scenarios: [
      { id: "sales_call", name: "Llamada de ventas", role: "Rachel, a busy purchasing manager receiving a sales call from the learner", open: "Hello, Rachel speaking. I have about five minutes. What can I do for you?" },
      { id: "sales_complaint", name: "Cliente molesto", role: "Mark, an annoyed customer whose order arrived damaged, talking to the learner in customer service", open: "Hi. My order arrived today and the box was completely broken. This is the second time!" },
    ],
  },

  tecnologia: {
    name: "Tecnología",
    en: "software and IT",
    cards: [
      ["deploy", "desplegar", "We deploy to production every Friday."],
      ["bug", "error de software", "I found a bug in the login page."],
      ["release", "versión, lanzamiento", "The next release includes dark mode."],
      ["stand-up", "reunión diaria", "In today's stand-up, share your blockers."],
      ["blocker", "impedimento", "My blocker is the missing API key."],
      ["pull request", "solicitud de cambios", "Please review my pull request."],
      ["requirement", "requisito", "The client changed the requirements again."],
      ["roll back", "revertir", "We had to roll back the update."],
      ["outage", "caída del servicio", "The outage lasted twenty minutes."],
      ["estimate", "estimación", "My estimate is three days of work."],
      ["troubleshoot", "diagnosticar un problema", "Let's troubleshoot the network issue."],
      ["user story", "historia de usuario", "Each user story needs acceptance criteria."],
    ],
    topics: [
      { t: "Explain a project you worked on to a non-technical person", h: "basically · it allows users to · my part was…" },
      { t: "Describe how you solved a difficult bug", h: "the issue was · I tracked it down · it turned out…" },
      { t: "Give your update for today's stand-up", h: "yesterday I · today I'll · my blocker is…" },
    ],
    scenarios: [
      { id: "it_standup", name: "Daily stand-up", role: "Priya, a scrum master running the daily stand-up with the learner", open: "Morning! Let's start with you. What did you work on yesterday?" },
      { id: "it_outage", name: "Caída del sistema", role: "James, a worried client whose website is down, talking to the learner from IT support", open: "Our website has been down for ten minutes and customers are calling. What's going on?" },
    ],
  },

  salud: {
    name: "Salud",
    en: "healthcare",
    cards: [
      ["appointment", "cita", "Your appointment is at 3 p.m."],
      ["symptom", "síntoma", "What symptoms do you have?"],
      ["prescription", "receta médica", "Take this prescription to the pharmacy."],
      ["dosage", "dosis", "The dosage is one tablet twice a day."],
      ["allergic to", "alérgico a", "Are you allergic to any medication?"],
      ["blood pressure", "presión arterial", "Your blood pressure is a bit high."],
      ["shift", "turno", "I work the night shift this week."],
      ["discharge", "dar de alta", "We'll discharge the patient tomorrow."],
      ["follow-up visit", "control", "Schedule a follow-up visit in two weeks."],
      ["side effect", "efecto secundario", "Dizziness is a common side effect."],
      ["sore throat", "dolor de garganta", "I've had a sore throat since Monday."],
      ["emergency room", "sala de emergencias", "He was taken to the emergency room."],
    ],
    topics: [
      { t: "Describe a typical day at your job", h: "my shift starts · I check · the most demanding part…" },
      { t: "Explain to a patient how to take a medicine", h: "you should take · avoid · if you notice…" },
      { t: "Talk about how to stay healthy", h: "it's important to · I'd recommend · in my experience…" },
    ],
    scenarios: [
      { id: "health_intake", name: "Admisión de paciente", role: "Mr. Brown, a tourist patient arriving at the clinic; the learner is the nurse doing the intake", open: "Hello, I'm not feeling well at all. I've had a fever since last night." },
      { id: "health_pharmacy", name: "Farmacia", role: "Emma, a customer at a pharmacy asking the learner (the pharmacist) about a medicine", open: "Hi, the doctor gave me this prescription. How often should I take it?" },
    ],
  },

  turismo: {
    name: "Turismo y hotelería",
    en: "tourism and hospitality",
    cards: [
      ["booking", "reserva", "I have a booking under the name Smith."],
      ["check-in", "registro de entrada", "Check-in starts at 2 p.m."],
      ["available", "disponible", "Is there a room available tonight?"],
      ["fully booked", "lleno, sin disponibilidad", "Sorry, we're fully booked this weekend."],
      ["sightseeing", "turismo, visitar lugares", "We went sightseeing in Cusco."],
      ["itinerary", "itinerario", "Here is your itinerary for the tour."],
      ["luggage", "equipaje", "You can leave your luggage at reception."],
      ["upgrade", "mejora de categoría", "We can offer you a free upgrade."],
      ["tour guide", "guía turístico", "Our tour guide speaks three languages."],
      ["altitude sickness", "mal de altura", "Drink coca tea to help with altitude sickness."],
      ["deposit", "depósito, adelanto", "We require a 30% deposit."],
      ["recommend", "recomendar", "What do you recommend for dinner?"],
    ],
    topics: [
      { t: "Recommend three places to visit in your country", h: "you shouldn't miss · it's famous for · the best time to go…" },
      { t: "Describe the best hotel or restaurant you know", h: "what makes it special · the staff · I'd highly recommend…" },
      { t: "Explain how to get from the airport to the city centre", h: "the easiest way · it takes about · make sure you…" },
    ],
    scenarios: [
      { id: "tour_reception", name: "Recepción del hotel", role: "Mrs. Taylor, a hotel guest arriving late at night with a problem with her booking; the learner works at reception", open: "Good evening. I booked a double room, but your website says my booking was cancelled. What happened?" },
      { id: "tour_guide", name: "Tour en Cusco", role: "Tom, a curious tourist on a city tour in Cusco; the learner is the tour guide", open: "This place is amazing! How old is this building, and who built it?" },
    ],
  },
};

export const PROFESSION_IDS = Object.keys(PROFESSIONS);
export const professionOf = s => PROFESSIONS[s && s.profile && s.profile.profession] || PROFESSIONS.general;
