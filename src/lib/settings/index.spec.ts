import { log } from '@nexus/logger'
import dedent from 'dedent'
import * as Lo from 'lodash'
import * as S from './'

// todo use https://github.com/SamVerschueren/tsd
describe('static typing', () => {
  it.todo('if no input type given it defaults to deep partial version of the data type')
  it.todo(
    'if a namespace in the input type is a union with non-object types then it forces the specifier to have a shorthand'
  )
})

describe('data initializers', () => {
  it('initializers may be static', () => {
    type d = { a: string }
    const settings = S.create<d>({ spec: { a: { initial: 'foobar' } } })
    expect(settings.data.a).toEqual('foobar')
  })

  it('initializers may be dynamic, they are resolved at create time', () => {
    type d = { a: string }
    const settings = S.create<d>({ spec: { a: { initial: () => 'foobar' } } })
    expect(settings.data.a).toEqual('foobar')
  })
  it('if the setting datum is optional then the setting initializer can be omited', () => {
    type d = { a?: string }
    // @ts-ignore
    // todo find way to make vscode use a tsconfig with strict mode for
    // co-located test modules
    const settings = S.create<d>({ spec: { a: {} } })
    expect(settings.data.a).toEqual(undefined)
  })

  it('if the setting datum is optional then the dynamic setting initializer can return undefined', () => {
    type d = { a?: string }
    const settings = S.create<d>({
      spec: {
        a: {
          initial() {
            return undefined
          },
        },
      },
    })
    expect(settings.data.a).toEqual(undefined)
  })
  it('if a dynamic initializer has unexpected error it fails gracefully', () => {
    expect(() =>
      S.create<{ a: string }>({
        spec: {
          a: {
            initial() {
              throw new Error('Unexpected error while trying to initialize setting')
            },
          },
        },
      })
    ).toThrow(dedent`
      There was an unexpected error while running the dynamic initializer for setting "a". The error was:
      Error: Unexpected error while trying to initialize setting
    `)
  })
})

describe('basics', () => {
  it('changing an array setting replaces the existing array', () => {
    const settings = S.create<{ a: string[] }>({ spec: { a: { initial: ['foo'] } } })
    expect(settings.change({ a: ['bar'] }).data).toEqual({ a: ['bar'] })
  })
  it('a setting datum can be optional', () => {
    type d = { a?: string }
    expect(
      // @ts-ignore
      // todo find way to make vscode use a tsconfig with strict mode for
      // co-located test modules
      S.create<d>({ spec: { a: {} } }).data
    ).toEqual({})
  })
})

describe('namespaced settings', () => {
  it('a setting may be a namespace holding more settings', () => {
    type d = { a: { b: string } }
    const settings = S.create<d>({ spec: { a: { fields: { b: { initial: '' } } } } })
    expect(settings.data.a.b).toEqual('')
  })
  it('a namespaced setting can be changed', () => {
    type d = { a: { b: string } }
    const settings = S.create<d>({ spec: { a: { fields: { b: { initial: 'b' } } } } })
    expect(settings.change({ a: { b: 'b2' } }).data).toEqual({ a: { b: 'b2' } })
  })
  it('changing namespaced settings merges deeply preserving existing settings not targetted by the change', () => {
    type d = { a: { a: string; b: number }; b: number }
    const settings = S.create<d>({
      spec: {
        a: {
          fields: {
            b: { initial: 1 },
            a: { initial: 'a' },
          },
        },
        b: { initial: 1 },
      },
    })
    expect(settings.change({ a: { a: 'a2' } }).data).toEqual({ a: { a: 'a2', b: 1 }, b: 1 })
  })
  it('giving object to a non-namespace will error gracefully', () => {
    type d = { a: string }
    const settings = S.create<d, any>({ spec: { a: { initial: '' } } })
    expect(() => settings.change({ a: { b: '' } })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is not a namespace and so does not accept objects, but one given: { b: '' }"`
    )
  })
})

describe('namespace shorthands', () => {
  it('a namespace may have a shorthand', () => {
    type d = { a: { b: string } }
    type i = { a: string | { b: string } }
    const settings = S.create<d, i>({
      spec: {
        a: {
          shorthand(value) {
            return { b: value + ' via shorthand!' }
          },
          fields: { b: { initial: '' } },
        },
      },
    })
    expect(settings.data.a.b).toEqual('')
    expect(settings.change({ a: 'some change' }).data.a).toEqual({ b: 'some change via shorthand!' })
  })
  it('unexpected shorthand errors fail gracefully', () => {
    type d = { a: { b: string } }
    type i = { a: string | { b: string } }
    const settings = S.create<d, i>({
      spec: {
        a: {
          shorthand(value) {
            throw new Error('Unexpected shorthand error')
          },
          fields: { b: { initial: '' } },
        },
      },
    })
    expect(() => settings.change({ a: 'some change' }).data.a).toThrow(dedent`
      There was an unexpected error while running the namespace shorthand for setting "a". The given value was 'some change'. The error was:
      Error: Unexpected shorthand error
    `)
  })
  it('a namespace with a shorthand still accepts non-shorthand input', () => {
    type d = { a: { b: string } }
    type i = { a: string | { b: string } }
    const settings = S.create<d, i>({
      spec: {
        a: {
          shorthand(value) {
            return { b: value + ' via shorthand!' }
          },
          fields: { b: { initial: '' } },
        },
      },
    })
    expect(settings.change({ a: { b: 'direct' } }).data.a).toEqual({ b: 'direct' })
  })
  it('a namespace shorthand can receive input that is not directly in the final data', () => {
    type d = { a: { b: string } }
    type i = { a: (() => number) | { b: string } }
    const settings = S.create<d, i>({
      spec: {
        a: {
          shorthand(f) {
            return { b: f().toString() }
          },
          fields: { b: { initial: '' } },
        },
      },
    })
    expect(settings.change({ a: () => 1 }).data).toEqual({ a: { b: '1' } })
  })
  it('giving shorthand to a namespace that does not support it will error gracefully', () => {
    type d = { a: { b: string } }
    const settings = S.create<d, any>({ spec: { a: { fields: { b: { initial: '' } } } } })
    expect(() => settings.change({ a: 'runtime error' })).toThrowErrorMatchingInlineSnapshot(
      `"Setting \\"a\\" is a namespace with no shorthand so expects an object but received a non-object: 'runtime error'"`
    )
  })
})

describe('runtime errors', () => {
  it('changing settings that do not exist will error gracefully', () => {
    type d = { a: string }
    const settings = S.create<d, any>({ spec: { a: { initial: '' } } })
    expect(() => settings.change({ z: '' })).toThrowErrorMatchingInlineSnapshot(
      `"Could not find a setting specifier for setting \\"z\\""`
    )
  })
})

it('a setting can be changed', () => {
  type d = { a: string }
  const settings = S.create<d>({ spec: { a: { initial: 'a' } } })
  expect(settings.change({ a: 'a2' }).data).toEqual({ a: 'a2' })
})

describe('fixups', () => {
  let logs: jest.Mock
  let logSettingsOriginal: any

  beforeEach(() => {
    logs = jest.fn()
    logSettingsOriginal = {
      output: log.settings.output,
      filter: log.settings.filter.originalInput,
      pretty: log.settings.pretty,
    }
    log.settings({ output: { write: logs }, pretty: false })
  })

  afterEach(() => {
    log.settings(logSettingsOriginal)
  })

  it('a setting can be fixed up', () => {
    const onFixup = jest.fn()
    type d = { path: string }
    const settings = S.create<d>({
      onFixup,
      spec: {
        path: {
          initial: '/foo',
          fixup(value) {
            if (value[0] === '/') return null
            return { messages: ['must have leading slash'], value: `/${value}` }
          },
        },
      },
    })
    expect(settings.change({ path: 'foo' }).data).toEqual({ path: '/foo' })
    expect(onFixup.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "after": "/foo",
            "before": "foo",
            "messages": Array [
              "must have leading slash",
            ],
            "name": "path",
          },
          [Function],
        ],
      ]
    `)
  })
  it('a namespace with shorthand runs through fixups too', () => {
    const onFixup = jest.fn()
    type d = { path: string | { to: string } }
    const settings = S.create<d>({
      onFixup,
      spec: {
        path: {
          shorthand(value) {
            return { to: value }
          },
          fields: {
            to: {
              initial: '/foo',
              fixup(value) {
                if (value[0] === '/') return null
                return { messages: ['must have leading slash'], value: `/${value}` }
              },
            },
          },
        },
      },
    })
    expect(settings.change({ path: 'foo' }).data).toEqual({ path: { to: '/foo' } })
    expect(onFixup.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "after": "/foo",
            "before": "foo",
            "messages": Array [
              "must have leading slash",
            ],
            "name": "to",
          },
          [Function],
        ],
      ]
    `)
  })
  it('if fixup fails it errors gracefully', () => {
    type d = { path: string }
    const settings = S.create<d>({
      spec: {
        path: {
          initial: '/',
          fixup() {
            throw new Error('Unexpected error!')
          },
        },
      },
    })
    expect(() => settings.change({ path: '' })).toThrowError(dedent`
      Fixup for "path" failed while running on value '':
      Error: Unexpected error!
    `)
  })
  it('if onFixup callback fails it errors gracefully', () => {
    const onFixup = jest.fn().mockImplementation(() => {
      throw new Error('Unexpected error!')
    })
    type d = { path: string }
    const settings = S.create<d>({
      onFixup,
      spec: {
        path: {
          initial: '/',
          fixup() {
            return { value: 'foobar', messages: [] }
          },
        },
      },
    })
    expect(() => settings.change({ path: '' })).toThrowError(dedent`
      onFixup callback for "path" failed:
      Error: Unexpected error!
    `)
  })
  it('if fixup returns null then onFixup is not called', () => {
    const onFixup = jest.fn()
    type d = { path: string }
    const settings = S.create<d>({
      onFixup,
      spec: {
        path: {
          initial: '/',
          fixup() {
            return null
          },
        },
      },
    })
    settings.change({ path: '' })
    expect(onFixup.mock.calls).toEqual([])
  })
  it('initial does not pass through fixup', () => {
    expect(
      S.create<{ a: string }>({
        spec: {
          a: {
            initial: '',
            fixup() {
              return { value: 'fixed', messages: [] }
            },
          },
        },
      }).data
    ).toEqual({ a: '' })
  })

  it('defualt onFixup handler is to log a warning', () => {
    log.settings({ filter: '*@warn' })
    const settings = S.create<{ a: string }>({
      spec: {
        a: {
          initial: '',
          fixup() {
            return { value: 'fixed', messages: ['...'] }
          },
        },
      },
    })
    settings.change({ a: 'foo' })
    expect(logs.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "{\\"event\\":\\"One of your setting values was invalid. We were able to automaticlaly fix it up now but please update your code.\\",\\"level\\":4,\\"path\\":[\\"settings\\"],\\"context\\":{\\"before\\":\\"foo\\",\\"after\\":\\"fixed\\",\\"name\\":\\"a\\",\\"messages\\":[\\"...\\"]}}
      ",
        ],
      ]
    `)
  })
  it('custom handler causes default to not run', () => {
    log.settings({ filter: '*@warn' })
    const settings = S.create<{ a: string }>({
      onFixup() {},
      spec: {
        a: {
          initial: '',
          fixup() {
            return { value: 'fixed', messages: ['...'] }
          },
        },
      },
    })
    settings.change({ a: 'foo' })
    expect(logs.mock.calls).toEqual([])
  })
  it('can call the original handler to retain the original base behaviour', () => {
    log.settings({ filter: '*@warn' })
    const settings = S.create<{ a: string }>({
      onFixup(info, original) {
        original(info)
      },
      spec: {
        a: {
          initial: '',
          fixup() {
            return { value: 'fixed', messages: ['...'] }
          },
        },
      },
    })
    settings.change({ a: 'foo' })
    expect(logs.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "{\\"event\\":\\"One of your setting values was invalid. We were able to automaticlaly fix it up now but please update your code.\\",\\"level\\":4,\\"path\\":[\\"settings\\"],\\"context\\":{\\"before\\":\\"foo\\",\\"after\\":\\"fixed\\",\\"name\\":\\"a\\",\\"messages\\":[\\"...\\"]}}
      ",
        ],
      ]
    `)
  })
})

describe('validators', () => {
  it('if a setting passes validation nothing happens', () => {
    const validate = jest.fn().mockImplementation(() => null)
    type d = { a: string }
    const settings = S.create<d>({
      spec: {
        a: {
          initial: 'foo',
          validate,
        },
      },
    })
    settings.change({ a: 'bar' })
    expect(validate.mock.calls).toEqual([['bar']])
  })
  it('if a setting fails validation then an error is thrown', () => {
    const validate = jest.fn().mockImplementation((value) => {
      if (value === 'bar') {
        return { messages: ['Too long', 'Too simple'] }
      }
    })
    const settings = S.create<{ a: string }>({
      spec: {
        a: {
          initial: 'foo',
          validate,
        },
      },
    })
    expect(() => settings.change({ a: 'bar' })).toThrowError(dedent`
      Your setting "a" failed validation with value 'bar':

      - Too long
      - Too simple
    `)
  })
  it('initial does not pass through validate', () => {
    const validate = jest.fn().mockImplementation((value) => {
      if (value === 'bad') {
        return { messages: ['Too long', 'Too simple'] }
      }
    })
    expect(
      S.create<{ a: string }>({
        spec: {
          a: {
            initial: 'bad',
            validate,
          },
        },
      })
    )
  })
  it('unexpected validator failures error gracefully', () => {
    const validate = jest.fn().mockImplementation((value) => {
      throw new Error('Unexpected error while trying to validate')
    })
    const settings = S.create<{ a: string }>({
      spec: {
        a: {
          initial: 'foo',
          validate,
        },
      },
    })
    expect(() => settings.change({ a: 'bar' })).toThrowError(dedent`
      Validation for "a" unexpectedly failed while running on value 'bar':
      Error: Unexpected error while trying to validate
    `)
  })
})

describe('.reset()', () => {
  it('returns api for chaining', () => {
    const settings = S.create<{ a: string }>({ spec: { a: { initial: '' } } })
    expect(settings.reset()).toBe(settings)
  })
  it('resets settings data & metadata to initial state', () => {
    const settings = S.create<{ a: string }>({ spec: { a: { initial: '' } } })
    settings.change({ a: 'foo' })
    expect(settings.reset().data).toEqual({ a: '' })
    expect(settings.reset().metadata).toEqual({ a: { from: 'initial', value: '', initial: '' } })
  })
  it('settings metadata & data references change', () => {
    const settings = S.create<{ a: string }>({ spec: { a: { initial: '' } } })
    const originalMetadata = settings.metadata
    const originalData = settings.data
    settings.reset()
    expect(settings.data).not.toBe(originalData)
    expect(settings.metadata).not.toBe(originalMetadata)
  })
  it('dynamic initializers are re-run', () => {
    process.env.foo = 'foo'
    const settings = S.create<{ a: string }>({ spec: { a: { initial: () => process.env.foo! } } })
    process.env.foo = 'bar'
    expect(settings.reset().metadata).toEqual({ a: { from: 'initial', value: 'bar', initial: 'bar' } })
    delete process.env.foo
  })
})

describe('.original()', () => {
  it('gets the settings as they were initially', () => {
    const settings = S.create<{ a: { a: string }; b: { a: number } }>({
      spec: {
        a: { fields: { a: { initial: () => 'foo' } } },
        b: { fields: { a: { initial: () => 1 } } },
      },
    })
    const original = Lo.cloneDeep(settings.data)
    settings.change({ a: { a: 'bar' }, b: { a: 2 } })
    expect(settings.original()).toEqual(original)
  })
})

describe('metadata', () => {
  it('tracks if a setting value comes from its initializer', () => {
    const settings = S.create<{ a: string }>({
      spec: {
        a: {
          initial: 'foo',
        },
      },
    })
    expect(settings.metadata).toEqual({ a: { from: 'initial', value: 'foo', initial: 'foo' } })
  })
  it('traces if a setting value comes from change input', () => {
    const settings = S.create<{ a: string }>({
      spec: {
        a: {
          initial: 'foo',
        },
      },
    })
    expect(settings.change({ a: 'bar' }).metadata).toEqual({
      a: { from: 'set', value: 'bar', initial: 'foo' },
    })
  })
  it('models namespaces', () => {
    const settings = S.create<{ a: { a: string } }>({
      spec: {
        a: {
          fields: {
            a: {
              initial: 'foo',
            },
          },
        },
      },
    })
    expect(settings.metadata).toEqual({
      a: { fields: { a: { from: 'initial', value: 'foo', initial: 'foo' } } },
    })
  })
})
