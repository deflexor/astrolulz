import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  { ignores: ['node_modules/', '.next/', 'out/', 'coverage/', 'content-out/'] },
  ...coreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
