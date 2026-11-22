// Tests for the practice-lab Git simulator.
// Run with:  node --test github-guide/tests/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { Sim, fromSetup, evaluate, diff3 } = require('../src/js/gitsim.js');

/** Run commands and fail loudly if any of them errors. */
function ok(sim, ...lines) {
  let last;
  for (const line of lines) {
    last = sim.run(line);
    assert.equal(last.err, false, `"${line}" failed:\n${last.out}`);
  }
  return last;
}

function repo(...lines) {
  const sim = new Sim();
  ok(sim, 'git init', ...lines);
  return sim;
}

function twoBranches() {
  // main: A - B - C        feature: A - B - D
  return repo(
    'printf "one\\ntwo\\nthree\\nfour\\nfive\\n" > notes.txt',
    'git add .', 'git commit -m "A"',
    'echo "readme" > README.md', 'git add .', 'git commit -m "B"',
    'git switch -c feature'
  );
}

// ---------------------------------------------------------------- diff3

test('diff3 merges edits to different lines', () => {
  const base = ['a', 'b', 'c', 'd', 'e'];
  const r = diff3(base, ['A', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'E'], { ours: 'HEAD', theirs: 'x' });
  assert.equal(r.conflict, false);
  assert.deepEqual(r.lines, ['A', 'b', 'c', 'd', 'E']);
});

test('diff3 conflicts when both sides change the same line', () => {
  const r = diff3(['a', 'b', 'c'], ['a', 'OURS', 'c'], ['a', 'THEIRS', 'c'], { ours: 'HEAD', theirs: 'feature' });
  assert.equal(r.conflict, true);
  assert.deepEqual(r.lines, ['a', '<<<<<<< HEAD', 'OURS', '=======', 'THEIRS', '>>>>>>> feature', 'c']);
});

test('diff3 treats adjacent changes as a conflict, like Git', () => {
  const r = diff3(['a', 'b', 'c', 'd'], ['a', 'B', 'c', 'd'], ['a', 'b', 'C', 'd'], { ours: 'HEAD', theirs: 'x' });
  assert.equal(r.conflict, true);
});

test('diff3 takes an identical change once', () => {
  const r = diff3(['a', 'b'], ['a', 'same'], ['a', 'same'], { ours: 'HEAD', theirs: 'x' });
  assert.equal(r.conflict, false);
  assert.deepEqual(r.lines, ['a', 'same']);
});

test('diff3 handles additions at the end from one side', () => {
  const r = diff3(['a'], ['a', 'b'], ['a'], { ours: 'HEAD', theirs: 'x' });
  assert.equal(r.conflict, false);
  assert.deepEqual(r.lines, ['a', 'b']);
});

// ------------------------------------------------------- basic snapshots

test('git commands need a repository first', () => {
  const sim = new Sim();
  const res = sim.run('git status');
  assert.equal(res.err, true);
  assert.match(res.out, /not a git repository/);
});

test('the working tree, staging area and commit are separate places', () => {
  const sim = repo('echo "hello" > a.txt');
  assert.deepEqual(sim.status().untracked, ['a.txt']);
  ok(sim, 'git add a.txt');
  assert.deepEqual(sim.status().staged, [{ path: 'a.txt', kind: 'new file' }]);
  ok(sim, 'git commit -m "Add a"');
  assert.equal(sim.status().clean, true);
  ok(sim, 'echo "more" >> a.txt');
  assert.deepEqual(sim.status().unstaged, [{ path: 'a.txt', kind: 'modified' }]);
  // staging a file then editing it again leaves it both staged and modified
  ok(sim, 'git add a.txt', 'echo "again" >> a.txt');
  assert.equal(sim.status().staged.length, 1);
  assert.equal(sim.status().unstaged.length, 1);
});

test('commit refuses when nothing is staged', () => {
  const sim = repo('echo "x" > a.txt', 'git add .', 'git commit -m "A"');
  const res = sim.run('git commit -m "nothing"');
  assert.equal(res.err, true);
  assert.match(res.out, /nothing to commit/);
});

test('commit -am stages tracked changes and commits', () => {
  const sim = repo('echo "x" > a.txt', 'git add .', 'git commit -m "A"', 'echo "y" >> a.txt', 'git commit -am "B"');
  assert.equal(sim.status().clean, true);
  assert.equal(Object.keys(sim.ancestors(sim.headSha())).length, 2);
});

test('log --oneline shows newest first with decorations', () => {
  const sim = repo('echo "x" > a.txt', 'git add .', 'git commit -m "First"', 'echo "y" >> a.txt', 'git commit -am "Second"');
  const lines = sim.run('git log --oneline').out.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /\(HEAD -> main\) Second$/);
  assert.match(lines[1], /First$/);
});

test('amend replaces the last commit instead of adding one', () => {
  const sim = repo('echo "x" > a.txt', 'git add .', 'git commit -m "Frist"');
  const before = sim.headSha();
  ok(sim, 'git commit --amend -m "First"');
  assert.notEqual(sim.headSha(), before);
  assert.equal(Object.keys(sim.ancestors(sim.headSha())).length, 1);
  assert.equal(sim.subject(sim.headSha()), 'First');
});

// --------------------------------------------------------------- branches

test('a new branch points at the same commit until you commit', () => {
  const sim = twoBranches();
  assert.equal(sim.branches.main, sim.branches.feature);
  ok(sim, 'echo "feature work" > f.txt', 'git add .', 'git commit -m "D"');
  assert.notEqual(sim.branches.main, sim.branches.feature);
  ok(sim, 'git switch main');
  assert.equal('f.txt' in sim.work, false, 'switching away removes the feature file from the working tree');
});

test('switching is blocked when it would overwrite local changes', () => {
  const sim = twoBranches();
  ok(sim, 'echo "feature version" > README.md', 'git commit -am "D"', 'git switch main', 'echo "local edit" > README.md');
  const res = sim.run('git switch feature');
  assert.equal(res.err, true);
  assert.match(res.out, /would be overwritten/);
  assert.equal(sim.currentBranch(), 'main');
});

test('uncommitted edits travel with you when the branches agree on that file', () => {
  const sim = twoBranches();
  ok(sim, 'echo "wip" >> README.md', 'git switch main');
  assert.match(sim.work['README.md'], /wip/);
});

test('branch -d refuses unmerged work, -D forces', () => {
  const sim = twoBranches();
  ok(sim, 'echo "f" > f.txt', 'git add .', 'git commit -m "D"', 'git switch main');
  assert.equal(sim.run('git branch -d feature').err, true);
  ok(sim, 'git branch -D feature');
  assert.equal(sim.branches.feature, undefined);
});

// ---------------------------------------------------------------- merging

test('fast-forward merge moves the pointer and adds no commit', () => {
  const sim = twoBranches();
  ok(sim, 'echo "f" > f.txt', 'git add .', 'git commit -m "D"', 'git switch main');
  const count = Object.keys(sim.commits).length;
  const res = ok(sim, 'git merge feature');
  assert.match(res.out, /Fast-forward/);
  assert.equal(Object.keys(sim.commits).length, count);
  assert.equal(sim.branches.main, sim.branches.feature);
});

test('--no-ff forces a merge commit with two parents', () => {
  const sim = twoBranches();
  ok(sim, 'echo "f" > f.txt', 'git add .', 'git commit -m "D"', 'git switch main', 'git merge --no-ff feature');
  assert.equal(sim.commits[sim.headSha()].parents.length, 2);
});

test('diverged branches merge cleanly when they touch different lines', () => {
  const sim = twoBranches();
  ok(sim,
    'printf "one\\ntwo\\nthree\\nfour\\nFIVE\\n" > notes.txt', 'git commit -am "D: change last line"',
    'git switch main',
    'printf "ONE\\ntwo\\nthree\\nfour\\nfive\\n" > notes.txt', 'git commit -am "C: change first line"',
    'git merge feature');
  assert.equal(sim.work['notes.txt'], 'ONE\ntwo\nthree\nfour\nFIVE\n');
  assert.equal(sim.commits[sim.headSha()].parents.length, 2);
  assert.equal(sim.status().clean, true);
});

function conflicted() {
  const sim = twoBranches();
  ok(sim,
    'printf "one\\nGREEN\\nthree\\nfour\\nfive\\n" > notes.txt', 'git commit -am "D: green"',
    'git switch main',
    'printf "one\\nRED\\nthree\\nfour\\nfive\\n" > notes.txt', 'git commit -am "C: red"');
  const res = sim.run('git merge feature');
  assert.equal(res.err, true);
  assert.match(res.out, /CONFLICT \(content\): Merge conflict in notes.txt/);
  return sim;
}

test('a conflict writes both sides into the file and waits', () => {
  const sim = conflicted();
  assert.equal(sim.work['notes.txt'], 'one\n<<<<<<< HEAD\nRED\n=======\nGREEN\n>>>>>>> feature\nthree\nfour\nfive\n');
  assert.deepEqual(sim.status().conflicted, ['notes.txt']);
  assert.equal(sim.run('git commit -m "nope"').err, true, 'cannot commit with unmerged paths');
  assert.match(sim.run('git status').out, /Unmerged paths/);
});

test('resolving is edit, add, commit: the result has two parents', () => {
  const sim = conflicted();
  sim.writeFile('notes.txt', 'one\nPURPLE\nthree\nfour\nfive');
  ok(sim, 'git add notes.txt');
  assert.match(sim.run('git status').out, /All conflicts fixed but you are still merging/);
  ok(sim, 'git commit');
  assert.equal(sim.commits[sim.headSha()].parents.length, 2);
  assert.equal(sim.subject(sim.headSha()), "Merge branch 'feature'");
  assert.equal(sim.pending, null);
  assert.equal(sim.status().clean, true);
});

test('merge --abort restores the pre-merge state exactly', () => {
  const sim = conflicted();
  const head = sim.headSha();
  ok(sim, 'git merge --abort');
  assert.equal(sim.headSha(), head);
  assert.equal(sim.work['notes.txt'], 'one\nRED\nthree\nfour\nfive\n');
  assert.equal(sim.status().clean, true);
});

test('checkout --theirs takes the incoming version of a conflicted file', () => {
  const sim = conflicted();
  ok(sim, 'git checkout --theirs -- notes.txt', 'git add notes.txt', 'git commit');
  assert.equal(sim.work['notes.txt'], 'one\nGREEN\nthree\nfour\nfive\n');
});

test('merge --squash stages the combined change without recording a merge', () => {
  const sim = twoBranches();
  ok(sim, 'echo "f1" > f.txt', 'git add .', 'git commit -m "D1"', 'echo "f2" >> f.txt', 'git commit -am "D2"',
    'git switch main', 'echo "m" > m.txt', 'git add .', 'git commit -m "C"', 'git merge --squash feature');
  assert.deepEqual(sim.status().staged, [{ path: 'f.txt', kind: 'new file' }]);
  ok(sim, 'git commit -m "Add feature"');
  assert.equal(sim.commits[sim.headSha()].parents.length, 1);
  assert.equal(sim.isAncestor(sim.branches.feature, sim.headSha()), false);
});

// ------------------------------------------------------------------- undo

test('reset --soft, --mixed and --hard differ in what they keep', () => {
  const make = () => repo('echo "v1" > a.txt', 'git add .', 'git commit -m "A"', 'echo "v2" > a.txt', 'git commit -am "B"');

  const soft = make();
  ok(soft, 'git reset --soft HEAD~1');
  assert.equal(soft.subject(soft.headSha()), 'A');
  assert.equal(soft.status().staged.length, 1, 'soft keeps the change staged');

  const mixed = make();
  ok(mixed, 'git reset HEAD~1');
  assert.equal(mixed.status().staged.length, 0);
  assert.equal(mixed.status().unstaged.length, 1, 'mixed keeps the change in the working tree');

  const hard = make();
  ok(hard, 'git reset --hard HEAD~1');
  assert.equal(hard.status().clean, true);
  assert.equal(hard.work['a.txt'], 'v1\n', 'hard discards the change');
});

test('a commit dropped by reset --hard is still in the reflog', () => {
  const sim = repo('echo "v1" > a.txt', 'git add .', 'git commit -m "A"', 'echo "v2" > a.txt', 'git commit -am "B"');
  const lost = sim.headSha();
  ok(sim, 'git reset --hard HEAD~1');
  assert.match(sim.run('git reflog').out, /commit: B/);
  ok(sim, 'git branch rescue HEAD@{1}');
  assert.equal(sim.branches.rescue, lost);
});

test('revert adds a new commit that undoes an old one', () => {
  const sim = repo('echo "v1" > a.txt', 'git add .', 'git commit -m "A"', 'echo "v2" > a.txt', 'git commit -am "B"',
    'echo "other" > b.txt', 'git add .', 'git commit -m "C"');
  ok(sim, 'git revert HEAD~1');
  assert.equal(sim.work['a.txt'], 'v1\n');
  assert.equal(sim.work['b.txt'], 'other\n', 'later work is kept');
  assert.equal(Object.keys(sim.ancestors(sim.headSha())).length, 4);
  assert.match(sim.subject(sim.headSha()), /^Revert "B"$/);
});

test('reverting a merge needs -m', () => {
  const sim = twoBranches();
  ok(sim, 'echo "f" > f.txt', 'git add .', 'git commit -m "D"', 'git switch main', 'git merge --no-ff feature');
  assert.equal(sim.run('git revert HEAD').err, true);
  ok(sim, 'git revert -m 1 HEAD');
  assert.equal('f.txt' in sim.work, false);
});

test('restore discards working changes; restore --staged unstages', () => {
  const sim = repo('echo "v1" > a.txt', 'git add .', 'git commit -m "A"', 'echo "v2" > a.txt', 'git add a.txt');
  ok(sim, 'git restore --staged a.txt');
  assert.equal(sim.status().staged.length, 0);
  assert.equal(sim.work['a.txt'], 'v2\n', 'unstaging keeps the edit');
  ok(sim, 'git restore a.txt');
  assert.equal(sim.work['a.txt'], 'v1\n');
});

test('stash shelves changes and pop brings them back', () => {
  const sim = repo('echo "v1" > a.txt', 'git add .', 'git commit -m "A"', 'echo "wip" >> a.txt');
  ok(sim, 'git stash');
  assert.equal(sim.status().clean, true);
  assert.equal(sim.stashes.length, 1);
  ok(sim, 'git stash pop');
  assert.equal(sim.work['a.txt'], 'v1\nwip\n');
  assert.equal(sim.stashes.length, 0);
});

// ---------------------------------------------------------------- history

test('rebase replays commits onto the new base with new ids', () => {
  const sim = twoBranches();
  ok(sim, 'echo "f" > f.txt', 'git add .', 'git commit -m "D"');
  const oldTip = sim.branches.feature;
  ok(sim, 'git switch main', 'echo "m" > m.txt', 'git add .', 'git commit -m "C"', 'git switch feature', 'git rebase main');
  assert.notEqual(sim.branches.feature, oldTip, 'the commit was rewritten');
  assert.equal(sim.isAncestor(sim.branches.main, sim.branches.feature), true);
  assert.equal(sim.commits[sim.branches.feature].parents.length, 1);
  assert.equal(sim.subject(sim.branches.feature), 'D');
  assert.equal(sim.currentBranch(), 'feature');
  assert.deepEqual(Object.keys(sim.work).sort(), ['README.md', 'f.txt', 'm.txt', 'notes.txt']);
});

test('a rebase conflict labels the sides the other way round and can continue', () => {
  const sim = twoBranches();
  ok(sim, 'printf "one\\nGREEN\\nthree\\nfour\\nfive\\n" > notes.txt', 'git commit -am "D: green"',
    'git switch main', 'printf "one\\nRED\\nthree\\nfour\\nfive\\n" > notes.txt', 'git commit -am "C: red"',
    'git switch feature');
  const res = sim.run('git rebase main');
  assert.equal(res.err, true);
  // HEAD is main's version here: the reverse of a merge run from feature
  assert.match(sim.work['notes.txt'], /<<<<<<< HEAD\nRED\n=======\nGREEN\n>>>>>>> [0-9a-f]{7} \(D: green\)/);
  sim.writeFile('notes.txt', 'one\nGREEN\nthree\nfour\nfive');
  ok(sim, 'git add notes.txt', 'git rebase --continue');
  assert.equal(sim.currentBranch(), 'feature');
  assert.equal(sim.pending, null);
  assert.equal(sim.isAncestor(sim.branches.main, sim.branches.feature), true);
});

test('rebase --abort returns the branch to where it started', () => {
  const sim = twoBranches();
  ok(sim, 'printf "one\\nGREEN\\nthree\\nfour\\nfive\\n" > notes.txt', 'git commit -am "D"',
    'git switch main', 'printf "one\\nRED\\nthree\\nfour\\nfive\\n" > notes.txt', 'git commit -am "C"', 'git switch feature');
  const tip = sim.branches.feature;
  sim.run('git rebase main');
  ok(sim, 'git rebase --abort');
  assert.equal(sim.branches.feature, tip);
  assert.equal(sim.currentBranch(), 'feature');
  assert.equal(sim.status().clean, true);
});

test('cherry-pick copies one commit onto the current branch', () => {
  const sim = twoBranches();
  ok(sim, 'echo "fix" > fix.txt', 'git add .', 'git commit -m "Fix bug"', 'echo "wip" > wip.txt', 'git add .', 'git commit -m "WIP"',
    'git switch main', 'git cherry-pick feature~1');
  assert.equal(sim.work['fix.txt'], 'fix\n');
  assert.equal('wip.txt' in sim.work, false);
  assert.equal(sim.subject(sim.headSha()), 'Fix bug');
});

test('detached HEAD commits are orphaned unless a branch saves them', () => {
  const sim = repo('echo "1" > a.txt', 'git add .', 'git commit -m "A"', 'echo "2" > a.txt', 'git commit -am "B"');
  ok(sim, 'git checkout HEAD~1');
  assert.equal(sim.status().detached, true);
  ok(sim, 'echo "experiment" > e.txt', 'git add .', 'git commit -m "Experiment"');
  const orphan = sim.headSha();
  const res = ok(sim, 'git switch main');
  assert.match(res.out, /you are leaving 1 commit behind/);
  ok(sim, 'git branch saved ' + orphan.slice(0, 7));
  assert.equal(sim.branches.saved, orphan);
});

// ----------------------------------------------------------------- remote

function withRemote() {
  const sim = repo('echo "hello" > README.md', 'git add .', 'git commit -m "Start"');
  ok(sim, '!origin');
  return sim;
}

test('fetch updates origin/main but leaves your branch alone', () => {
  const sim = withRemote();
  sim.run('!teammate msg="Teammate change" file=team.txt text=hi', { silent: true });
  const mine = sim.branches.main;
  ok(sim, 'git fetch');
  assert.equal(sim.branches.main, mine);
  assert.notEqual(sim.tracking['origin/main'], mine);
  assert.equal(sim.status().behind, 1);
  ok(sim, 'git pull');
  assert.equal(sim.branches.main, sim.tracking['origin/main']);
  assert.equal(sim.work['team.txt'], 'hi\n');
});

test('a push is rejected when the remote has commits you lack; pull then push works', () => {
  const sim = withRemote();
  sim.run('!teammate msg="Teammate change" file=team.txt text=hi', { silent: true });
  ok(sim, 'echo "mine" > mine.txt', 'git add .', 'git commit -m "My change"');
  const rejected = sim.run('git push');
  assert.equal(rejected.err, true);
  assert.match(rejected.out, /\[rejected\]/);
  ok(sim, 'git pull', 'git push');
  assert.equal(sim.remote.branches.main, sim.branches.main);
  assert.equal(sim.commits[sim.headSha()].parents.length, 2, 'pull made a merge commit');
});

test('push needs an upstream the first time', () => {
  const sim = withRemote();
  ok(sim, 'git switch -c feature', 'echo "f" > f.txt', 'git add .', 'git commit -m "F"');
  assert.match(sim.run('git push').out, /has no upstream branch/);
  ok(sim, 'git push -u origin feature');
  assert.equal(sim.remote.branches.feature, sim.branches.feature);
  assert.equal(sim.upstream.feature, 'origin/feature');
});

test('force-with-lease refuses when the remote moved behind your back', () => {
  const sim = withRemote();
  ok(sim, 'git switch -c feature', 'echo "f" > f.txt', 'git add .', 'git commit -m "F"', 'git push -u origin feature');
  ok(sim, 'git commit --amend -m "F, reworded"');
  sim.run('!teammate branch=feature msg="Teammate fix" file=t.txt text=x', { silent: true });
  const res = sim.run('git push --force-with-lease');
  assert.equal(res.err, true);
  assert.match(res.out, /stale info/);
  const forced = sim.run('git push --force');
  assert.equal(forced.err, false, '--force overwrites regardless, which is the danger');
});

test('a protected branch rejects direct pushes', () => {
  const sim = repo('echo "hello" > README.md', 'git add .', 'git commit -m "Start"');
  ok(sim, '!origin protect=main', 'echo "x" >> README.md', 'git commit -am "Direct"');
  const res = sim.run('git push');
  assert.equal(res.err, true);
  assert.match(res.out, /GH006/);
});

test('the pull request loop: push, create, squash-merge, clean up', () => {
  const sim = withRemote();
  ok(sim, 'git switch -c add-eval', 'echo "eval" > eval.py', 'git add .', 'git commit -m "Add eval script"',
    'echo "more" >> eval.py', 'git commit -am "Polish eval"');
  assert.equal(sim.run('gh pr create --title "Add eval"').err, true, 'must push first');
  ok(sim, 'git push -u origin add-eval', 'gh pr create --title "Add eval"');
  assert.equal(sim.remote.prs[0].state, 'OPEN');
  ok(sim, 'gh pr merge --squash --delete-branch');
  assert.equal(sim.remote.prs[0].state, 'MERGED');
  assert.equal(sim.currentBranch(), 'main');
  assert.equal(sim.branches['add-eval'], undefined);
  assert.equal(sim.subject(sim.branches.main), 'Add eval (#1)');
  assert.equal(sim.work['eval.py'], 'eval\nmore\n');
});

// ------------------------------------------------------------ lab checks

test('evaluate understands the check vocabulary', () => {
  const sim = conflicted();
  assert.equal(evaluate({ merging: true, conflicts: 1 }, sim, []), true);
  assert.equal(evaluate({ fileContains: { path: 'notes.txt', text: '<<<<<<<' } }, sim, []), true);
  assert.equal(evaluate({ not: { clean: true } }, sim, []), true);
  assert.equal(evaluate({ ran: '^git status' }, sim, ['git status']), true);
  assert.equal(evaluate({ ran: '^git status' }, sim, ['git log']), false);
  assert.equal(evaluate({ branchExists: ['main', 'feature'], branch: 'main' }, sim, []), true);
});

// ------------------------------------------------------- interactive rebase

function messy() {
  // main: A        feature: A - one - two - three - four
  return repo('echo "base" > base.txt', 'git add .', 'git commit -m "A"', 'git switch -c feature',
    'echo "1" > one.txt', 'git add .', 'git commit -m "one"',
    'echo "2" > two.txt', 'git add .', 'git commit -m "two"',
    'echo "1b" > one.txt', 'git commit -am "three: touch one again"',
    'echo "junk" > junk.txt', 'git add .', 'git commit -m "four: junk"');
}

/** Commit subjects on the current branch that main does not have, newest first. */
function subjects(sim) {
  return sim.run('git log --oneline main..HEAD').out.split('\n').filter(Boolean)
    .map(line => line.replace(/^[0-9a-f]+ (\([^)]*\) )?/, ''));
}

test('rebase -i opens a plan and changes nothing until it starts', () => {
  const sim = messy(), before = sim.headSha();
  ok(sim, 'git rebase -i main');
  assert.equal(sim.todoPlan.items.length, 4);
  assert.deepEqual(sim.todoPlan.items.map(i => i.action), ['pick', 'pick', 'pick', 'pick']);
  assert.equal(sim.headSha(), before);
  const blocked = sim.run('git commit --allow-empty -m "sneaky"');
  assert.equal(blocked.err, true);
  assert.match(blocked.out, /plan is open/);
  ok(sim, 'git status', 'git log --oneline');
  ok(sim, 'git rebase --abort');
  assert.equal(sim.todoPlan, null);
  assert.equal(sim.headSha(), before);
});

test('a plan can fixup, reword, drop and reorder in one pass', () => {
  const sim = messy(), old = sim.headSha();
  ok(sim, 'git rebase -i main');
  const res = sim.startPlan(sim.planFromSpec([
    { pick: 'one' }, { fixup: 'three' }, { reword: 'two', message: 'Add the second file' }, { drop: 'four' }
  ]));
  assert.match(res, /Successfully rebased/);
  assert.deepEqual(subjects(sim), ['Add the second file', 'one']);
  assert.equal(sim.work['one.txt'], '1b\n', 'the fixup folded the later edit into the first commit');
  assert.equal('junk.txt' in sim.work, false, 'the dropped commit left nothing behind');
  assert.equal(sim.currentBranch(), 'feature');
  assert.equal(sim.status().clean, true);
  assert.equal(sim.isAncestor(old, sim.headSha()), false, 'the old commits were replaced, not extended');
  assert.match(sim.run('git reflog').out, /four: junk/, 'and they are still in the reflog');
});

test('squash joins the two messages; fixup keeps only the first', () => {
  const sim = messy();
  ok(sim, 'git rebase -i main');
  sim.startPlan(sim.planFromSpec([{ pick: 'one' }, { squash: 'two' }, { pick: 'three' }, { pick: 'four' }]));
  const first = sim.resolve('HEAD~2');
  assert.equal(sim.commits[first].message, 'one\n\ntwo');
  assert.equal(subjects(sim).length, 3);
});

test('the first commit you keep cannot be a fixup', () => {
  const sim = messy();
  ok(sim, 'git rebase -i main');
  assert.throws(() => sim.startPlan(sim.planFromSpec([{ fixup: 'one' }, { pick: 'two' }, { pick: 'three' }, { pick: 'four' }])),
    err => /without a previous commit/.test(err.message));
  assert.notEqual(sim.todoPlan, null, 'a rejected plan stays open so it can be corrected');
});

test('a commit left out of the plan is dropped', () => {
  const sim = messy();
  ok(sim, 'git rebase -i main');
  sim.startPlan(sim.planFromSpec([{ pick: 'one' }, { pick: 'two' }]));
  assert.deepEqual(subjects(sim), ['two', 'one']);
});

test('commit --fixup and rebase --autosquash arrange the plan for you', () => {
  const sim = repo('echo "base" > base.txt', 'git add .', 'git commit -m "A"', 'git switch -c feature',
    'echo "1" > one.txt', 'git add .', 'git commit -m "Add one"',
    'echo "2" > two.txt', 'git add .', 'git commit -m "Add two"',
    'echo "1 fixed" > one.txt', 'git commit -a --fixup HEAD~1');
  assert.equal(sim.subject(sim.headSha()), 'fixup! Add one');
  ok(sim, 'git rebase -i --autosquash main');
  assert.deepEqual(sim.todoPlan.items.map(i => [i.action, sim.subject(i.sha)]),
    [['pick', 'Add one'], ['fixup', 'fixup! Add one'], ['pick', 'Add two']]);
  sim.startPlan();
  assert.deepEqual(subjects(sim), ['Add two', 'Add one']);
  assert.equal(sim.work['one.txt'], '1 fixed\n');
});

test('a conflict inside a plan stops, and --continue carries on with the rest', () => {
  const sim = repo('echo "orig" > f.txt', 'git add .', 'git commit -m "A"', 'git switch -c feature',
    'echo "first" > f.txt', 'git commit -am "c1"',
    'echo "second" > f.txt', 'git commit -am "c2"',
    'echo "other" > g.txt', 'git add .', 'git commit -m "c3"');
  ok(sim, 'git rebase -i main');
  // dropping c1 makes c2 apply to text it was never written against
  const res = sim.startPlan(sim.planFromSpec([{ drop: 'c1' }, { pick: 'c2' }, { fixup: 'c3' }]));
  assert.equal(res.err, true);
  assert.match(res.out, /CONFLICT/);
  assert.equal(sim.pending.kind, 'rebase');
  sim.writeFile('f.txt', 'second');
  ok(sim, 'git add f.txt', 'git rebase --continue');
  assert.equal(sim.pending, null);
  assert.deepEqual(subjects(sim), ['c2'], 'c3 was folded into c2 after the conflict was settled');
  assert.equal(sim.work['g.txt'], 'other\n');
});

// --------------------------------------------------------------- .gitignore

function withIgnore() {
  const sim = repo('echo "x" > a.txt', 'git add .', 'git commit -m "A"',
    'echo "log" > logs/run.log', 'echo "w" > model.pt', 'echo "w" > keep.pt', 'echo "rows" > data/train.csv', 'echo "rows" > src/data/train.csv');
  sim.writeFile('.gitignore', '# outputs\nlogs/\n*.pt\n!keep.pt\n/data/*.csv\n');
  return sim;
}

test('.gitignore hides matching files from status and from git add .', () => {
  const sim = withIgnore();
  assert.deepEqual(sim.status().untracked, ['.gitignore', 'keep.pt', 'src/data/train.csv']);
  assert.deepEqual(sim.status().ignored, ['data/train.csv', 'logs/run.log', 'model.pt']);
  ok(sim, 'git add .');
  assert.deepEqual(sim.status().staged.map(f => f.path), ['.gitignore', 'keep.pt', 'src/data/train.csv']);
  assert.match(sim.run('git status --ignored').out, /Ignored files:[\s\S]*model\.pt/);
});

test('naming an ignored file is an error, and -f overrides it', () => {
  const sim = withIgnore();
  const res = sim.run('git add model.pt');
  assert.equal(res.err, true);
  assert.match(res.out, /ignored by one of your \.gitignore files/);
  ok(sim, 'git add -f model.pt');
  assert.ok(sim.status().staged.some(f => f.path === 'model.pt'));
  assert.equal(sim.run('git check-ignore -v logs/run.log').out, '.gitignore:logs/\tlogs/run.log');
  assert.equal(sim.run('git check-ignore keep.pt').err, true, 'a negated pattern re-includes the file');
});

test('a file that is already tracked stays tracked when a pattern matches it', () => {
  const sim = repo('echo "w1" > model.pt', 'git add .', 'git commit -m "Oops"');
  sim.writeFile('.gitignore', '*.pt\n');
  ok(sim, 'echo "w2" > model.pt');
  assert.deepEqual(sim.status().unstaged, [{ path: 'model.pt', kind: 'modified' }]);
  ok(sim, 'git rm --cached model.pt', 'git add .gitignore', 'git commit -m "Stop tracking weights"');
  assert.deepEqual(sim.status().ignored, ['model.pt'], 'after rm --cached the pattern takes effect');
  assert.equal(sim.work['model.pt'], 'w2\n', 'and the file is still on disk');
});

test('ignored files survive branch switches, hard resets and git clean', () => {
  const sim = repo('echo "x" > a.txt', 'git add .', 'git commit -m "A"');
  sim.writeFile('.gitignore', '*.log\n');
  ok(sim, 'git add .gitignore', 'git commit -m "Ignore logs"', 'echo "trace" > debug.log', 'echo "scratch" > scratch.txt',
    'git switch -c other', 'git switch main', 'git reset --hard HEAD', 'git clean -f');
  assert.equal(sim.work['debug.log'], 'trace\n');
  assert.equal('scratch.txt' in sim.work, false, 'clean removes untracked files and leaves ignored ones');
});

// -------------------------------------------------------------- large files

test('GitHub refuses a file over 100 MB, and a later commit that removes it does not help', () => {
  const sim = withRemote();
  ok(sim, 'truncate -s 150M model.pt', 'git add .', 'git commit -m "Add outputs"');
  assert.match(sim.run('ls -lh').out, /150M\s+model\.pt/);
  let res = sim.run('git push');
  assert.equal(res.err, true);
  assert.match(res.out, /GH001/);
  assert.match(res.out, /model\.pt is 150\.00 MB/);

  ok(sim, 'git rm --cached model.pt', 'git commit -m "Remove it"');
  res = sim.run('git push');
  assert.equal(res.err, true, 'the earlier commit still carries the file');

  ok(sim, 'git reset --soft origin/main', 'git commit --allow-empty -m "Start again"', 'git push');
  assert.equal(sim.remote.branches.main, sim.branches.main);
});

test('a file between 50 and 100 MB is pushed with a warning', () => {
  const sim = withRemote();
  ok(sim, 'truncate -s 60M data.bin', 'git add .', 'git commit -m "Add data"');
  const res = ok(sim, 'git push');
  assert.match(res.out, /recommended maximum file size of 50\.00 MB/);
});

test('the newer lab checks work', () => {
  const sim = messy();
  assert.equal(evaluate({ exactCommits: { feature: 5 }, rebasePlanOpen: false }, sim, []), true);
  ok(sim, 'git rebase -i main');
  assert.equal(evaluate({ rebasePlanOpen: true }, sim, []), true);
  assert.equal(evaluate({ historyHasFile: { ref: 'feature', path: 'junk.txt' } }, sim, []), true);
  assert.equal(evaluate({ historyHasFile: { ref: 'main', path: 'junk.txt' } }, sim, []), false);
  const ig = withIgnore();
  assert.equal(evaluate({ ignored: ['model.pt'] }, ig, []), true);
  assert.equal(evaluate({ ignored: ['keep.pt'] }, ig, []), false);
});

// Every guided lab must be completable with its own suggested commands.
const labs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'labs.json'), 'utf8'));
for (const lab of labs) {
  if (lab.draft) continue;
  test(`lab "${lab.id}" can be completed with its suggested commands`, () => {
    const sim = fromSetup(lab.setup);
    lab.steps.forEach((step, n) => {
      const ran = [];
      for (const line of step.before || []) {
        const res = sim.run(line, { silent: true });
        assert.equal(res.err, false, `step ${n + 1}: before-command "${line}" failed:\n${res.out}`);
      }
      assert.equal(evaluate(step.check, sim, ran), false, `step ${n + 1} ("${step.goal}") is already satisfied before the learner acts`);
      for (const line of step.suggest) {
        const res = sim.run(line);
        ran.push(line);
        if (res.err) {
          // an error is fine only when the step is about seeing that error
          assert.ok(/CONFLICT|rejected|would be overwritten|not fully merged|ignored by one of/.test(res.out), `step ${n + 1}: "${line}" failed unexpectedly:\n${res.out}`);
        }
      }
      if (step.plan) {
        // a step may be completed in the rebase plan editor: apply the lab's suggested plan
        const res = sim.startPlan(sim.planFromSpec(step.plan));
        assert.ok(typeof res === 'string', `step ${n + 1}: the suggested rebase plan did not finish cleanly:\n${res.out}`);
      }
      assert.equal(evaluate(step.check, sim, ran), true, `step ${n + 1} ("${step.goal}") did not pass its check after the suggested commands`);
    });
  });
}
