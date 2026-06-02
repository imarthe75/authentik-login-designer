import { TestBed } from '@angular/core/testing';
import { EmailTemplateService } from './email-template.service';
import { Theme, EmailEventType, EMAIL_EVENT_TYPES } from '../models/theme.model';

const MINIMAL_THEME: Theme = {
  authentik_flow_slug: 'test-flow',
  authentik_app_slug: null,
  display_name: 'Test Portal',
  system_name: 'Test',
  system_subtitle: '',
  layout_position: 'left',
  name_align: 'center',
  subtitle_align: 'center',
  privacy_align: 'center',
  primary_color: '#4272A5',
  hover_color: '#2d5580',
  card_bg_color: '#FFFFFF',
  panel_bg_color: '#F6F9FD',
  bg_type: 'gradient',
  bg_flat_color: null,
  bg_gradient_from: '#c8c4bc',
  bg_gradient_to: '#a09890',
  bg_image_base64: null,
  bg_opacity: 1,
  form_opacity: 0.55,
  form_height_pct: null,
  logos_opacity: 0.55,
  logos_height_pct: null,
  logo_top_base64: null,
  logo_bottom_base64: null,
  logo_top_text: null,
  logo_bottom_text: null,
  privacy_pdf_url: null,
  is_active: true,
  allow_self_registration: false,
  require_email_verification: false,
  show_social_google: false,
  show_social_microsoft: false,
  show_social_gov_id: false,
  email_footer_text: null,
  email_template_type: 'integrated',
};

const FULL_THEME: Theme = {
  ...MINIMAL_THEME,
  logo_top_base64: 'data:image/png;base64,abc123',
  email_footer_text: '© 2026 CASMARTS. Todos los derechos reservados.',
  email_bodies: {
    password_reset: {
      subject: 'Restablece tu contraseña en Test Portal',
      body_html: '<p>Hola {{ user.username }}, haz clic: {{ url }}</p>',
    },
  },
};

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EmailTemplateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateEmailHtml — all 5 event types with MINIMAL_THEME', () => {
    EMAIL_EVENT_TYPES.forEach((evt: EmailEventType) => {
      it(`renders valid HTML for event: ${evt}`, () => {
        const html = service.generateEmailHtml(MINIMAL_THEME, evt);
        expect(html).toContain('<!DOCTYPE html');
        expect(html).toContain('#4272A5');
        expect(html).not.toContain('{{ user.username }}');
        expect(html).not.toContain('{{ url }}');
        expect(html).not.toContain('{{ token }}');
      });
    });
  });

  describe('generateEmailHtml — all 5 event types with FULL_THEME', () => {
    EMAIL_EVENT_TYPES.forEach((evt: EmailEventType) => {
      it(`renders valid HTML with full theme for event: ${evt}`, () => {
        const html = service.generateEmailHtml(FULL_THEME, evt);
        expect(html).toContain('<!DOCTYPE html');
        expect(html).toContain('#4272A5');
        expect(html).toContain('© 2026 CASMARTS');
      });
    });
  });

  it('substitutes Authentik vars with preview values', () => {
    const html = service.generateEmailHtml(FULL_THEME, 'password_reset');
    expect(html).not.toContain('{{ user.username }}');
    expect(html).not.toContain('{{ url }}');
    expect(html).toContain('usuario.ejemplo');
    expect(html).toContain('TOK-PREVIEW-12345');
  });

  it('uses override when provided', () => {
    const html = service.generateEmailHtml(MINIMAL_THEME, 'password_reset', {
      subject: 'Custom subject',
      body_html: '<p>Custom body</p>',
    });
    expect(html).toContain('Custom subject');
    expect(html).toContain('Custom body');
  });

  it('omits logo when base64 exceeds 200 KB', () => {
    const bigLogo = 'data:image/png;base64,' + 'A'.repeat(210 * 1024);
    const theme = { ...MINIMAL_THEME, logo_top_base64: bigLogo };
    const html = service.generateEmailHtml(theme, 'password_reset');
    expect(html).not.toContain('<img');
  });

  it('uses empty footer when email_footer_text is null', () => {
    const html = service.generateEmailHtml(MINIMAL_THEME, 'password_reset');
    // Should not throw; footer cell should be present but empty
    expect(html).toContain('font-size:11px');
  });

  it('substitutes tenant.name with display_name', () => {
    const theme = {
      ...MINIMAL_THEME,
      email_bodies: {
        password_reset: { subject: 'Bienvenido a {{ tenant.name }}', body_html: '' },
      },
    };
    const html = service.generateEmailHtml(theme, 'password_reset');
    expect(html).toContain('Test Portal');
    expect(html).not.toContain('{{ tenant.name }}');
  });
});
