import { ActionIcon, Button, Tooltip, type ActionIconProps, type ButtonProps } from '@mantine/core';
import type { ComponentPropsWithoutRef } from 'react';
import type { EstadoProyecto, Permiso } from '@autofix/core';
import { usePermisos } from '../sesion/use-permisos';

type BotonProtegidoProps = ButtonProps &
  Omit<ComponentPropsWithoutRef<'button'>, keyof ButtonProps> & {
    permiso: Permiso;
    estadoProyecto?: EstadoProyecto;
  };

export function BotonProtegido({
  permiso,
  estadoProyecto,
  onClick,
  ...props
}: BotonProtegidoProps) {
  const { motivoBloqueo } = usePermisos();
  const bloqueo = motivoBloqueo(permiso, estadoProyecto);

  if (!bloqueo) return <Button onClick={onClick} {...props} />;

  return (
    <Tooltip label={bloqueo}>
      <Button
        {...props}
        data-disabled
        aria-disabled
        onClick={(evento) => evento.preventDefault()}
      />
    </Tooltip>
  );
}

type AccionProtegidaProps = ActionIconProps &
  Omit<ComponentPropsWithoutRef<'button'>, keyof ActionIconProps> & {
    permiso: Permiso;
    estadoProyecto?: EstadoProyecto;
    tooltip?: string;
    bloqueo?: string | null;
  };

export function AccionProtegida({
  permiso,
  estadoProyecto,
  tooltip,
  bloqueo: bloqueoProp,
  onClick,
  ...props
}: AccionProtegidaProps) {
  const { motivoBloqueo } = usePermisos();
  const bloqueoRol = motivoBloqueo(permiso, estadoProyecto);
  const bloqueoFinal = bloqueoRol || (bloqueoProp ?? null);
  const etiqueta = bloqueoFinal
    ? tooltip
      ? `${tooltip} (${bloqueoFinal})`
      : bloqueoFinal
    : (tooltip ?? props['aria-label']);

  if (!bloqueoFinal) {
    if (tooltip) {
      return (
        <Tooltip label={tooltip}>
          <ActionIcon {...props} aria-label={etiqueta} onClick={onClick} />
        </Tooltip>
      );
    }
    return <ActionIcon {...props} aria-label={etiqueta} onClick={onClick} />;
  }

  return (
    <Tooltip label={bloqueoFinal}>
      <ActionIcon
        {...props}
        aria-label={etiqueta}
        data-disabled
        aria-disabled
        onClick={(evento) => evento.preventDefault()}
      />
    </Tooltip>
  );
}
