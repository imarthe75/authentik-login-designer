// Espejo de TenantContext.tsx / TenantSelector.tsx del manager (React).
// NOTA: el backend de este designer no expone hoy /api/v1/tenant/resolve ni
// /api/v1/tenant/list (a diferencia del backend del manager) — ver comentario
// en ThemeApiService.resolveTenant(). Este modelo y los servicios que lo usan
// están listos para cuando ese endpoint se porte; mientras tanto degradan a
// DEFAULT_TENANT.
export interface Tenant {
  tenant_id: string;
  tenant_name: string;
  domain_pattern: string;
  primary_color: string;
  secondary_color: string;
}

export const DEFAULT_TENANT: Tenant = {
  tenant_id: '00000000-0000-0000-0000-000000000001',
  tenant_name: 'CASMARTS Core',
  domain_pattern: 'casmarts.local',
  primary_color: '#4272A5',
  secondary_color: '#2d5580',
};
