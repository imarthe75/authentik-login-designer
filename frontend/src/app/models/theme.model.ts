export type AlignValue = 'left' | 'center' | 'right';
export type BgType = 'gradient' | 'color' | 'image';
export type SavePhase = 'idle' | 'saving' | 'deploying' | 'done' | 'deploy_error';

export interface Theme {
  id?: string;
  authentik_flow_slug: string;
  authentik_app_slug?: string | null;
  display_name: string;
  system_name: string;
  system_subtitle: string;
  layout_position: AlignValue;
  name_align: AlignValue;
  subtitle_align: AlignValue;
  privacy_align: AlignValue;
  primary_color: string;
  hover_color: string;
  card_bg_color: string;
  panel_bg_color: string;
  bg_type: BgType;
  bg_flat_color: string | null;
  bg_gradient_from: string;
  bg_gradient_to: string;
  bg_image_base64: string | null;
  bg_opacity: number;
  form_opacity: number;
  form_height_pct: number | null;
  logos_opacity: number;
  logos_height_pct: number | null;
  logo_top_base64: string | null;
  logo_bottom_base64: string | null;
  logo_top_text: string | null;
  logo_bottom_text: string | null;
  privacy_pdf_url: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
