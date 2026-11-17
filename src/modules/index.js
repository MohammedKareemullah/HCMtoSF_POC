import headcountRoutes from "./headcount/headcount.routes.js";
import hcmCoreRoutes from "./hcm_core/hcm_core.routes.js";
import paRoutes from "./pa/pa.routes.js";
import omRoutes from "./om/om.routes.js";
import peRoutes from "./pe/pe.routes.js";
import tmRoutes from "./tm/tm.routes.js";
import headerRoutes from "./header/header.routes.js";

/** Register every KPI section here. One line per module. */
export function registerModules(app) {
  app.use("/api/headcount", headcountRoutes);
  app.use("/api/hcm-core", hcmCoreRoutes);
  app.use("/api/pa", paRoutes);
  app.use("/api/om", omRoutes);
  app.use("/api/pe", peRoutes);
  app.use("/api/tm", tmRoutes);
  app.use("/api/header", headerRoutes);
}
