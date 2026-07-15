export const HOME = {
  emergentLink: "home-emergent-link",
  hero: "home-hero",
  ctaExplore: "home-cta-explore",
  ctaConstruction: "home-cta-construction",
};

export const NAV = {
  brand: "nav-brand",
  home: "nav-home",
  properties: "nav-properties",
  construction: "nav-construction",
  about: "nav-about",
  contact: "nav-contact",
  login: "nav-login-btn",
  admin: "nav-admin",
  logout: "nav-logout-btn",
  user: "nav-user-name",
  mobileToggle: "nav-mobile-toggle",
};

export const PROP = {
  grid: "properties-grid",
  card: (id) => `property-card-${id}`,
  price: (id) => `property-price-${id}`,
  gate: (id) => `property-gate-${id}`,
  seePriceBtn: (id) => `property-see-price-${id}`,
  filterZone: "properties-filter-zone",
  filterType: "properties-filter-type",
  clearFilters: "properties-clear-filters",
};

export const AUTH = {
  modal: "auth-modal",
  googleBtn: "auth-google-btn",
  close: "auth-modal-close",
};

export const CONTACT = {
  form: "contact-form",
  name: "contact-name",
  phone: "contact-phone",
  email: "contact-email",
  interest: "contact-interest",
  message: "contact-message",
  submit: "contact-submit",
  whatsapp: "contact-whatsapp-btn",
};

export const CONSTR = {
  hero: "constr-hero",
  form: "constr-form",
  name: "constr-name",
  phone: "constr-phone",
  plot: "constr-plot",
  budget: "constr-budget",
  submit: "constr-submit",
};

export const ADMIN = {
  navLeads: "admin-nav-leads",
  navReports: "admin-nav-reports",
  navInvoices: "admin-nav-invoices",
  leadsTable: "admin-leads-table",
  leadRow: (id) => `admin-lead-row-${id}`,
  leadStatus: (id) => `admin-lead-status-${id}`,
  semanticInput: "admin-semantic-input",
  semanticRun: "admin-semantic-run",
  filterStatus: "admin-filter-status",
  filterSource: "admin-filter-source",
  exportCsv: "admin-export-csv",
  invoiceClient: "invoice-client-name",
  invoiceEmail: "invoice-client-email",
  invoiceProperty: "invoice-property",
  invoiceAmount: "invoice-amount",
  invoiceSchedule: "invoice-schedule",
  invoiceCreate: "invoice-create-btn",
  invoiceGenerate: (id) => `invoice-generate-${id}`,
  invoiceList: "invoice-list",
  reports: "admin-reports",
};

export const WHATSAPP = { floating: "floating-whatsapp" };
