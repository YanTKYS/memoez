import { ChangeNotifyingNoteRepository } from '@/data/repositories/ChangeNotifyingNoteRepository';
import { FakeNoteRepo } from '@/domain/usecases/testing/fakeRepos';

function setup() {
  const inner = new FakeNoteRepo();
  const onChanged = jest.fn();
  return { inner, onChanged, repo: new ChangeNotifyingNoteRepository(inner, onChanged) };
}

describe('ChangeNotifyingNoteRepository', () => {
  it('notifies after every kind of write (editor, list, backup import all go through here)', async () => {
    const { repo, onChanged } = setup();
    const note = await repo.create({ title: 'a', content: '', type: 'TEXT', color: 'NONE' });
    await repo.update(note.id, { title: 'b' });
    await repo.updateChecklistItems(note.id, [{ text: 'x', isChecked: false, position: 0 }]);
    await repo.togglePin(note.id);
    await repo.toggleArchive(note.id);
    await repo.updateColor(note.id, 'RED');
    await repo.attachLabel(note.id, 1);
    await repo.detachLabel(note.id, 1);
    await repo.delete(note.id);
    await repo.hardDelete(note.id);

    expect(onChanged).toHaveBeenCalledTimes(10);
  });

  it('does not notify on reads', async () => {
    const { repo, inner, onChanged } = setup();
    const note = await inner.create({ title: 'a', content: '', type: 'TEXT', color: 'NONE' });

    await repo.findAll();
    await repo.findById(note.id);
    await repo.search('a');
    await repo.findByLabel(1);
    await repo.maxSortWeight();

    expect(onChanged).not.toHaveBeenCalled();
  });

  it('does not notify when the write fails', async () => {
    const { repo, onChanged } = setup();
    let failed = false;
    try {
      await repo.update(999, { title: 'missing' });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('returns the wrapped repository results unchanged', async () => {
    const { repo, inner } = setup();
    const created = await repo.create({ title: 't', content: 'c', type: 'TEXT', color: 'BLUE' });
    expect(await repo.findById(created.id)).toEqual(await inner.findById(created.id));
  });
});
