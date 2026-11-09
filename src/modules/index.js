import headcountRoutes from "./headcount/headcount.routes.js";
import hcmCoreRoutes from "./hcm_core/hcm_core.routes.js";

/** Register every KPI section here. One line per module. */
export function registerModules(app) {
  app.use("/api/headcount", headcountRoutes);
  app.use("/api/hcm-core", hcmCoreRoutes);
}
