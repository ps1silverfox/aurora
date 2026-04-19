import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/*" element={<AdminLayout userName="Alice" userRole="editor" />}>
          <Route index element={<div>Dashboard content</div>} />
          <Route path="pages" element={<div>Pages content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminLayout', () => {
  it('renders brand name', () => {
    renderLayout();
    expect(screen.getByText('Aurora CMS')).toBeInTheDocument();
  });

  it('renders all nav links', () => {
    renderLayout();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('displays user name and role in topbar', () => {
    renderLayout();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
  });

  it('renders outlet content', () => {
    renderLayout('/');
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('toggles sidebar collapsed class on collapse button click', () => {
    const { container } = renderLayout();
    const layoutEl = container.querySelector('.admin-layout');
    expect(layoutEl).not.toHaveClass('admin-layout--collapsed');
    fireEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(layoutEl).toHaveClass('admin-layout--collapsed');
  });

  it('toggles sidebar via topbar menu button', () => {
    const { container } = renderLayout();
    const layoutEl = container.querySelector('.admin-layout');
    fireEvent.click(screen.getByLabelText('Toggle sidebar'));
    expect(layoutEl).toHaveClass('admin-layout--collapsed');
    fireEvent.click(screen.getByLabelText('Toggle sidebar'));
    expect(layoutEl).not.toHaveClass('admin-layout--collapsed');
  });

  it('renders logout button', () => {
    renderLayout();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });
});
