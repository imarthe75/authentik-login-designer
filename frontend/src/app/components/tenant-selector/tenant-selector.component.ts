import { Component, Input, Output, EventEmitter, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantStateService } from '../../services/tenant-state.service';

/**
 * Puerto Angular de TenantSelector.tsx (manager/React). Ver nota de blocker
 * en TenantStateService — hoy la lista de tenants estará vacía porque el
 * backend del designer no expone /api/v1/tenant/list, pero el componente
 * maneja ese estado (loading / error / vacío) igual que React.
 *
 * Nota de seguridad: todo el contenido (nombre de tenant, dominio, colores)
 * se renderiza con interpolación de texto Angular ({{ }}) o bindings de
 * propiedad ([style.backgroundColor]) — nunca vía innerHTML — por lo que no
 * hace falta el pipe safeHtml aquí (no hay HTML de por medio).
 */
@Component({
  selector: 'app-tenant-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tenant-selector.component.html'
})
export class TenantSelectorComponent implements OnInit {
  private readonly tenantState = inject(TenantStateService);

  @Input() selectedTenantId: string | null = null;
  @Input() disabled = false;
  @Output() selectTenant = new EventEmitter<{ tenantId: string; tenantName: string }>();

  readonly tenants = this.tenantState.tenants;
  readonly loading = this.tenantState.tenantsLoading;
  readonly error = this.tenantState.tenantsError;

  readonly selectedTenant = computed(() =>
    this.tenants().find(t => t.tenant_id === this.selectedTenantId)
  );

  ngOnInit(): void {
    this.tenantState.loadTenants();
  }

  onSelectChange(tenantId: string): void {
    const tenant = this.tenants().find(t => t.tenant_id === tenantId);
    if (tenant) {
      this.selectTenant.emit({ tenantId: tenant.tenant_id, tenantName: tenant.tenant_name });
    }
  }
}
