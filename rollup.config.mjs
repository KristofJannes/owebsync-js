import { nodeResolve } from "@rollup/plugin-node-resolve";
import es6ClassMinify from "rollup-plugin-es6-class-minify";
import typescript from "rollup-plugin-typescript2";
import { terser } from "rollup-plugin-terser";
import rimraf from "rimraf";

rimraf.sync("dist");

function config(input, outputFile, outputFormat) {
  return {
    input: input,
    output: {
      name: "OWebSync",
      file: outputFile,
      format: outputFormat,
      exports: "auto",
    },
    external: ["levelup", "leveldown", "ws"],
    plugins: [
      typescript({}),
      nodeResolve({
        preferBuiltins: true,
      }),
      es6ClassMinify(),
      terser({
        compress: {
          module: false,
          passes: 2,
          toplevel: false,
        },
        format: {
          comments: false,
        },
        mangle: true,
      }),
    ],
  };
}

export default [
  config("src/browser/index.ts", "dist/owebsync-browser.js", "iife"),
  config("src/nodejs/index.ts", "dist/owebsync-nodejs.js", "cjs"),
];
