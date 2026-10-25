// ════════════════════════════════════════════════════════
//  CONFIGURACIÓN
//  Misma base de datos Supabase que la app de etiquetado.
//  La clave "publishable" es pública por diseño: sin iniciar
//  sesión no da acceso a ninguna tabla de albaranes (alb_*).
//
//  Para probar sin base de datos, deja SUPABASE_URL vacío ('')
//  o abre la página con ?prueba al final de la dirección.
// ════════════════════════════════════════════════════════
window.CONFIG = {
  SUPABASE_URL: 'https://ccxrxphkipuicixnwsuo.supabase.co',
  SUPABASE_KEY: 'sb_publishable_tNd5_wo3cRKTWMnX9-AESg_1cGoEZk5',
  BUCKET_PDF: 'albaranes',
  MAX_LINEAS: 14
};
