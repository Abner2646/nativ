-- Add button_style to tenant_settings
alter table tenant_settings
  add column if not exists button_style text not null default 'rounded';
