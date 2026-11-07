import { describeGeneratedStack } from './generated-repo-readme';

describe('describeGeneratedStack', () => {
  it.each([
    ['nestjs', 'NestJS API'],
    ['nextjs', 'Next.js app'],
    ['react', 'React app'],
    ['dotnet', '.NET service'],
    ['nodejs', 'Node.js service'],
  ])('describes %s', (stack, label) => {
    expect(describeGeneratedStack(stack)).toBe(label);
  });
});
