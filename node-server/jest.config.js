module.exports = {
  testEnvironment: 'node',

  // 项目用了 module-alias（见 package.json 的 _moduleAliases），但那套别名只在运行时生效，
  // jest 解析模块时走自己的规则。之前没配这一段，测试一碰到 @models/xxx 就直接挂掉。
  // 这里把同一套别名映射过来，注意顺序：具体别名在前，兜底的 ^@/ 必须放最后。
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/core/$1',
    '^@middlewares/(.*)$': '<rootDir>/middlewares/$1',
    '^@api/(.*)$': '<rootDir>/app/api/$1',
    '^@controller/(.*)$': '<rootDir>/app/controller/$1',
    '^@dao/(.*)$': '<rootDir>/app/dao/$1',
    '^@lib/(.*)$': '<rootDir>/app/lib/$1',
    '^@models/(.*)$': '<rootDir>/app/models/$1',
    '^@service/(.*)$': '<rootDir>/app/service/$1',
    '^@validators/(.*)$': '<rootDir>/app/validators/$1',
    '^@app/(.*)$': '<rootDir>/app/$1',
    '^@/(.*)$': '<rootDir>/$1'
  }
}
