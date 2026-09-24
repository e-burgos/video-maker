import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TabPanel, Tabs } from './tabs';

type Id = 'one' | 'two';

describe('Tabs', () => {
  it('marks the current tab as selected and the others as not', () => {
    render(
      <Tabs
        idPrefix="demo"
        value="one"
        onChange={() => undefined}
        tabs={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
        ]}
      />,
    );

    expect(screen.getByTestId('demo-tab-one').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('demo-tab-two').getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange with the id of the clicked tab', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        idPrefix="demo"
        value="one"
        onChange={onChange}
        tabs={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId('demo-tab-two'));

    expect(onChange).toHaveBeenCalledWith('two');
  });

  it('renders an optional badge next to the label', () => {
    render(
      <Tabs
        idPrefix="demo"
        value="one"
        onChange={() => undefined}
        tabs={[{ id: 'one', label: 'One', badge: '3' }]}
      />,
    );

    expect(screen.getByTestId('demo-tab-one').textContent).toContain('3');
  });
});

describe('TabPanel', () => {
  it('renders only the panel matching the current value', () => {
    render(
      <>
        <TabPanel<Id> id="one" value="one" idPrefix="demo">
          <p>panel one</p>
        </TabPanel>
        <TabPanel<Id> id="two" value="one" idPrefix="demo">
          <p>panel two</p>
        </TabPanel>
      </>,
    );

    expect(screen.getByText('panel one')).toBeTruthy();
    expect(screen.queryByText('panel two')).toBeNull();
  });
});
