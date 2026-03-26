/** Options page: manage the degenerative-content blacklist stored in chrome.storage.local. */

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function isValidDomain(value: string): boolean {
  return DOMAIN_RE.test(value.trim());
}

async function getBlacklist(): Promise<string[]> {
  const result = await chrome.storage.local.get('blacklist');
  return Array.isArray(result.blacklist) ? result.blacklist : [];
}

async function saveBlacklist(list: string[]): Promise<void> {
  await chrome.storage.local.set({ blacklist: list });
}

function renderList(list: string[]): void {
  const ul = document.getElementById('domain-list') as HTMLUListElement;
  ul.innerHTML = '';

  for (const domain of list) {
    const li = document.createElement('li');
    li.textContent = domain;

    const btn = document.createElement('button');
    btn.className = 'remove';
    btn.textContent = 'Remove';
    btn.addEventListener('click', async () => {
      const current = await getBlacklist();
      const updated = current.filter((d) => d !== domain);
      await saveBlacklist(updated);
      renderList(updated);
    });

    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function showError(msg: string): void {
  const el = document.getElementById('error-msg');
  if (el) el.textContent = msg;
}

function clearError(): void {
  const el = document.getElementById('error-msg');
  if (el) el.textContent = '';
}

document.addEventListener('DOMContentLoaded', async () => {
  const list = await getBlacklist();
  renderList(list);

  const input = document.getElementById('new-domain') as HTMLInputElement;
  const addBtn = document.getElementById('add-btn') as HTMLButtonElement;

  async function handleAdd(): Promise<void> {
    const raw = input.value.trim().toLowerCase();
    clearError();

    if (!raw) {
      showError('Please enter a domain.');
      return;
    }

    if (!isValidDomain(raw)) {
      showError('Invalid domain format. Use bare domain, e.g. reddit.com');
      return;
    }

    const current = await getBlacklist();

    if (current.includes(raw)) {
      showError(`${raw} is already in the list.`);
      return;
    }

    const updated = [...current, raw];
    await saveBlacklist(updated);
    renderList(updated);
    input.value = '';
  }

  addBtn.addEventListener('click', handleAdd);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdd();
  });
});
