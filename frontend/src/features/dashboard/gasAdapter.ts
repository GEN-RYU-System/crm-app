import { getDashboardKpis } from '../../gas/client';
import type { DashboardRepository } from './contracts';

export const dashboardGasRepository: DashboardRepository = {
  getKpis: getDashboardKpis,
};
