import { render, screen } from '@testing-library/react';
import {
  Button,
  Collapse,
  GlassPanel,
  MacOSTahoeLayout,
  Modal,
  SegmentedControl,
  StateBadge,
  ThemeScope,
  type IMenuItem,
} from '@e-burgos/tucu-ui';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

const segmentOptions = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

function MountedPrimitives() {
  return (
    <>
      <GlassPanel material="thick">panel</GlassPanel>
      <SegmentedControl options={segmentOptions} value="light" onChange={() => undefined} label="Tema" />
      <StateBadge tone="green" dot>
        listo
      </StateBadge>
      <Button variant="solid">Guardar</Button>
      <Collapse label="Detalle" initialOpen>
        contenido
      </Collapse>
      <Modal isOpen title="Aviso">
        cuerpo del modal
      </Modal>
    </>
  );
}

function expectPrimitivesRendered() {
  expect(screen.getByText('panel')).toBeTruthy();
  expect(screen.getByRole('radiogroup')).toBeTruthy();
  expect(screen.getByText('listo')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
  expect(screen.getByText('contenido')).toBeTruthy();
  expect(screen.getByText('cuerpo del modal')).toBeTruthy();
}

describe('montaje de tucu-ui sin ThemeProvider', () => {
  it('renderiza los primitivos sin provider ni scope', () => {
    render(<MountedPrimitives />);
    expectPrimitivesRendered();
  });

  it('renderiza los primitivos dentro de ThemeScope', () => {
    render(
      <ThemeScope mode="dark">
        <MountedPrimitives />
      </ThemeScope>,
    );
    expectPrimitivesRendered();
  });

  it('el layout Tahoe comparte el router del host y toma el título de pageTitle', () => {
    const menuItems: IMenuItem[] = [{ name: 'Mis videos', href: '/', icon: null }];
    render(
      <MemoryRouter>
        <MacOSTahoeLayout menuItems={menuItems} pageTitle="Mis videos" rightButton={<button>Nuevo</button>}>
          <p>pantalla</p>
        </MacOSTahoeLayout>
      </MemoryRouter>,
    );
    expect(screen.getByText('pantalla')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeTruthy();
  });
});
