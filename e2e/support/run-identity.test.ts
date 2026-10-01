import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SUBNET_CANDIDATES, parseEnvFile, runNames } from './run-identity.ts';

// node:test returns a promise from each call; the runner collects them, so nothing is awaited here.
void describe('runNames', () => {
  void it('derives the project, network, and image tag from the run id', () => {
    assert.deepEqual(runNames('3f9a1c'), {
      project: 'hearth-e2e-3f9a1c',
      network: 'hearth-e2e-3f9a1c',
      imageTag: 'e2e-3f9a1c',
    });
  });

  void it('gives two run ids two different projects, networks, and image tags', () => {
    const a = runNames('3f9a1c');
    const b = runNames('0b7e42');
    assert.notEqual(a.project, b.project);
    assert.notEqual(a.network, b.network);
    assert.notEqual(a.imageTag, b.imageTag);
  });

  void it('refuses an id Docker would reject as a project or tag name', () => {
    for (const bad of ['', 'ABC', 'a_b', 'a-b', 'a b', 'x'.repeat(17)]) {
      assert.throws(() => runNames(bad), /HEARTH_E2E_RUN_ID/, `accepted '${bad}'`);
    }
  });
});

void describe('SUBNET_CANDIDATES', () => {
  void it('offers distinct /24 subnets, all above the production stack at 172.16.238.0/24', () => {
    const subnets = SUBNET_CANDIDATES.map((candidate) => candidate.subnet);
    assert.equal(new Set(subnets).size, subnets.length);
    for (const subnet of subnets) {
      const match = /^172\.16\.(\d+)\.0\/24$/.exec(subnet);
      assert.ok(match, `not a 172.16.x.0/24 subnet: ${subnet}`);
      assert.ok(Number(match[1]) > 238, `overlaps the production stack: ${subnet}`);
    }
  });

  void it('puts each gateway inside its own subnet', () => {
    for (const { subnet, gateway } of SUBNET_CANDIDATES) {
      const prefix = subnet.replace(/\.0\/24$/, '.');
      assert.ok(
        gateway.startsWith(prefix) && gateway.endsWith('.1'),
        `${gateway} not in ${subnet}`,
      );
    }
  });
});

void describe('parseEnvFile', () => {
  void it('reads KEY=value lines and ignores comments, blank lines, and lowercase keys', () => {
    assert.deepEqual(parseEnvFile('A=1\n# comment\nlower=x\nB=two=parts\n\nC=\n'), {
      A: '1',
      B: 'two=parts',
      C: '',
    });
  });
});
