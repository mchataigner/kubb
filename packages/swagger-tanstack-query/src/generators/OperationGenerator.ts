import { camelCase, pascalCase } from 'change-case'

import type { PluginContext, File, FileManager, OptionalPath } from '@kubb/core'
import { getRelativePath, objectToParameters, createJSDocBlockText } from '@kubb/core'
import { pluginName as swaggerTypescriptPluginName } from '@kubb/swagger-ts'
import { OperationGenerator as Generator } from '@kubb/swagger'
import type { Oas, Operation } from '@kubb/swagger'

import { pluginName } from '../plugin'

import type { ResolveIdOptions } from '../types'

type Options = {
  framework: 'react' | 'solid' | 'svelte' | 'vue'
  clientPath?: OptionalPath
  oas: Oas
  directory: string
  fileManager: FileManager
  resolveId: PluginContext<ResolveIdOptions>['resolveId']
}

export class OperationGenerator extends Generator<Options> {
  getFrameworkSpecificImports(framework: Options['framework']): {
    getName: (operation: Operation) => string
    query: {
      useQuery: string
      QueryKey: string
      UseQueryResult: string
      UseQueryOptions: string
      QueryOptions: string
    }
    mutate: {
      useMutation: string
      UseMutationOptions: string
    }
  } {
    if (framework === 'svelte') {
      return {
        getName: (operation) => `${camelCase(`${operation.getOperationId()} query`, { delimiter: '' })}`,
        query: {
          useQuery: 'createQuery',
          QueryKey: 'QueryKey',
          UseQueryResult: 'CreateQueryResult',
          UseQueryOptions: 'CreateQueryOptions',
          QueryOptions: 'CreateQueryOptions',
        },
        mutate: {
          useMutation: 'createMutation',
          UseMutationOptions: 'CreateMutationOptions',
        },
      }
    }

    if (framework === 'solid') {
      return {
        getName: (operation) => `${camelCase(`${operation.getOperationId()} query`, { delimiter: '' })}`,
        query: {
          useQuery: 'createQuery',
          QueryKey: 'QueryKey',
          UseQueryResult: 'CreateQueryResult',
          UseQueryOptions: 'CreateQueryOptions',
          QueryOptions: 'CreateQueryOptions',
        },
        mutate: {
          useMutation: 'createMutation',
          UseMutationOptions: 'CreateMutationOptions',
        },
      }
    }

    if (framework === 'vue') {
      return {
        getName: (operation) => `${camelCase(`use ${operation.getOperationId()}`, { delimiter: '' })}`,
        query: {
          useQuery: 'useQuery',
          QueryKey: 'QueryKey',
          UseQueryResult: 'UseQueryReturnType',
          UseQueryOptions: 'UseQueryOptions',
          QueryOptions: 'QueryOptions',
        },
        mutate: {
          useMutation: 'useMutation',
          UseMutationOptions: 'VueMutationObserverOptions',
        },
      }
    }

    return {
      getName: (operation) => `${camelCase(`use ${operation.getOperationId()}`, { delimiter: '' })}`,
      query: {
        useQuery: 'useQuery',
        QueryKey: 'QueryKey',
        UseQueryResult: 'UseQueryResult',
        UseQueryOptions: 'UseQueryOptions',
        QueryOptions: 'QueryOptions',
      },
      mutate: {
        useMutation: 'useMutation',
        UseMutationOptions: 'UseMutationOptions',
      },
    }
  }

  getQueryImports(type: 'query' | 'mutate'): Required<File>['imports'] {
    const { framework } = this.options

    if (framework === 'svelte') {
      return [
        {
          name: Object.values(this.getFrameworkSpecificImports('svelte')[type]),
          path: '@tanstack/svelte-query',
        },
      ]
    }

    if (framework === 'solid') {
      return [
        {
          name: Object.values(this.getFrameworkSpecificImports('solid')[type]),
          path: '@tanstack/solid-query',
        },
      ]
    }

    if (framework === 'vue') {
      return [
        {
          name: ['VueMutationObserverOptions'],
          path: '@tanstack/vue-query/build/lib/useMutation',
          isTypeOnly: true,
        },
        {
          name: Object.values(this.getFrameworkSpecificImports('vue')[type]).filter((item) => item !== 'VueMutationObserverOptions'),
          path: '@tanstack/vue-query',
        },
      ]
    }

    return [
      {
        name: Object.values(this.getFrameworkSpecificImports('react')[type]),
        path: '@tanstack/react-query',
      },
    ]
  }

  async getGet(path: string): Promise<File | null> {
    const { oas, directory, resolveId, clientPath, framework } = this.options

    const operation = oas.operation(path, 'get')

    if (!operation.schema.operationId) return null

    // hook setup
    const imports = this.getFrameworkSpecificImports(framework)
    const hookName = imports.getName(operation)
    const hookId = `${hookName}.ts`
    const hookFilePath = await resolveId({
      fileName: hookId,
      directory,
      pluginName,
      options: { tag: operation.getTags()[0]?.name },
    })

    if (!hookFilePath) {
      return null
    }
    // end hook setup

    // type creation

    const schemas = this.getSchemas(operation)

    const typeName = `${pascalCase(operation.getOperationId(), { delimiter: '' })}.ts`
    const typeFilePath = await resolveId({ fileName: typeName, directory, pluginName: swaggerTypescriptPluginName })

    // hook creation

    const comments = this.getComments(operation)
    const sources: string[] = []
    const queryKey = `${camelCase(`${operation.getOperationId()}QueryKey`)}`
    let url = operation.path
    let pathParamsTyped = ''
    let pathParams = ''

    if (schemas.pathParams) {
      // TODO move to it's own function(utils)
      url = url.replaceAll('{', '${')

      const data = Object.entries(schemas.pathParams.schema.properties!).map((item) => {
        return [item[0], schemas.pathParams!.name]
      })

      pathParamsTyped = objectToParameters(data, { typed: true })
      pathParams = objectToParameters(data)
    }

    if (schemas.queryParams && !schemas.pathParams) {
      sources.push(`
        export const ${queryKey} = (params?: ${schemas.queryParams.name}) => [\`${url}\`, ...(params ? [params] : [])] as const;
      `)

      sources.push(`
        export function ${camelCase(`${operation.getOperationId()}QueryOptions`)} <TData = ${schemas.response.name}>(params?: ${schemas.queryParams.name}): ${
        imports.query.QueryOptions
      }<TData> {
          const queryKey =${framework === 'solid' ? `() => ${queryKey}(params)` : `${queryKey}(params)`};

          return {
            queryKey,
            queryFn: () => {
              return client<TData>({
                method: "get",
                url: \`${url}\`,
                params
              });
            },
          };
        };
      `)

      sources.push(`
        ${createJSDocBlockText({ comments })}
        export function ${hookName} <TData = ${schemas.response.name}>(params?: ${schemas.queryParams.name}, options?: { query?: ${
        imports.query.UseQueryOptions
      }<TData> }): ${imports.query.UseQueryResult}<TData, unknown> & { queryKey: QueryKey } {
          const { query: queryOptions } = options ?? {};
          const queryKey = queryOptions?.queryKey${framework === 'solid' ? `?.()` : ''} ?? ${queryKey}(params);
          
          const query = ${imports.query.useQuery}<TData>({
            ...${camelCase(`${operation.getOperationId()}QueryOptions`)}<TData>(params),
            ...queryOptions
          }) as ${imports.query.UseQueryResult}<TData, unknown> & { queryKey: QueryKey };

          query.queryKey = queryKey as QueryKey;

          return query;
        };
      `)
    }

    if (!schemas.queryParams && schemas.pathParams) {
      sources.push(`
        export const ${queryKey} = (${pathParamsTyped}) => [\`${url}\`] as const;
      `)

      sources.push(`
        export function ${camelCase(`${operation.getOperationId()}QueryOptions`)} <TData = ${schemas.response.name}>(${pathParamsTyped}): ${
        imports.query.QueryOptions
      }<TData> {
          const queryKey =${framework === 'solid' ? `() => ${queryKey}(${pathParams})` : `${queryKey}(${pathParams})`};

          return {
            queryKey,
            queryFn: () => {
              return client<TData>({
                method: "get",
                url: \`${url}\`
              });
            },
          };
        };
      `)

      sources.push(`
        ${createJSDocBlockText({ comments })}
        export function ${hookName} <TData = ${schemas.response.name}>(${pathParamsTyped} options?: { query?: ${imports.query.UseQueryOptions}<TData> }): ${
        imports.query.UseQueryResult
      }<TData, unknown> & { queryKey: QueryKey } {
          const { query: queryOptions } = options ?? {};
          const queryKey = queryOptions?.queryKey${framework === 'solid' ? `?.()` : ''} ?? ${queryKey}(${pathParams});
          
          const query = ${imports.query.useQuery}<TData>({
            ...${camelCase(`${operation.getOperationId()}QueryOptions`)}<TData>(${pathParams}),
            ...queryOptions
          }) as ${imports.query.UseQueryResult}<TData, unknown> & { queryKey: QueryKey };

          query.queryKey = queryKey as QueryKey;

          return query;
        };
      `)
    }

    if (schemas.queryParams && schemas.pathParams) {
      sources.push(`
        export const ${queryKey} = (${pathParamsTyped} params?: ${schemas.queryParams.name}) => [\`${url}\`, ...(params ? [params] : [])] as const;
      `)

      sources.push(`
        export function ${camelCase(`${operation.getOperationId()}QueryOptions`)} <TData = ${schemas.response.name}>(${pathParamsTyped} params?: ${
        schemas.queryParams.name
      }): ${imports.query.QueryOptions}<TData> {
          const queryKey =${framework === 'solid' ? `() => ${queryKey}(${pathParams} params)` : `${queryKey}(${pathParams} params)`};

          return {
            queryKey,
            queryFn: () => {
              return client<TData>({
                method: "get",
                url: \`${url}\`,
                params
              });
            },
          };
        };
      `)

      sources.push(`
        ${createJSDocBlockText({ comments })}
        export function ${hookName} <TData = ${schemas.response.name}>(${pathParamsTyped} params?: ${schemas.queryParams.name}, options?: { query?: ${
        imports.query.UseQueryOptions
      }<TData> }): ${imports.query.UseQueryResult}<TData, unknown> & { queryKey: QueryKey } {
          const { query: queryOptions } = options ?? {};
          const queryKey = queryOptions?.queryKey${framework === 'solid' ? `?.()` : ''} ?? ${queryKey}(${pathParams} params);
          
          const query = ${imports.query.useQuery}<TData>({
            ...${camelCase(`${operation.getOperationId()}QueryOptions`)}<TData>(${pathParams} params),
            ...queryOptions
          }) as ${imports.query.UseQueryResult}<TData, unknown> & { queryKey: QueryKey };

          query.queryKey = queryKey as QueryKey;

          return query;
        };
      `)
    }

    if (!schemas.queryParams && !schemas.pathParams) {
      sources.push(`
        export const ${queryKey} = () => [\`${url}\`] as const;
      `)

      sources.push(`
      export function ${camelCase(`${operation.getOperationId()}QueryOptions`)} <TData = ${schemas.response.name}>(): ${imports.query.QueryOptions}<TData> {
        const queryKey =${framework === 'solid' ? `() => ${queryKey}()` : `${queryKey}()`};

        return {
          queryKey,
          queryFn: () => {
            return client<TData>({
              method: "get",
              url: \`${url}\`
            });
          },
        };
      };
    `)

      sources.push(`
        ${createJSDocBlockText({ comments })}
        export function ${hookName} <TData = ${schemas.response.name}>(options?: { query?: ${imports.query.UseQueryOptions}<TData> }): ${
        imports.query.UseQueryResult
      }<TData, unknown> & { queryKey: QueryKey } {
          const { query: queryOptions } = options ?? {};
          const queryKey = queryOptions?.queryKey${framework === 'solid' ? `?.()` : ''} ?? ${queryKey}();

          const query = ${imports.query.useQuery}<TData>({
            ...${camelCase(`${operation.getOperationId()}QueryOptions`)}<TData>(),
            ...queryOptions
          }) as ${imports.query.UseQueryResult}<TData, unknown> & { queryKey: QueryKey };

          query.queryKey = queryKey as QueryKey;

          return query;
        };
      `)
    }

    return {
      path: hookFilePath,
      fileName: hookId,
      source: sources.join('\n'),
      imports: [
        ...this.getQueryImports('query'),
        {
          name: 'client',
          path: clientPath ? getRelativePath(hookFilePath, clientPath) : '@kubb/swagger-client/client',
        },
        {
          name: [schemas.response.name, schemas.pathParams?.name, schemas.queryParams?.name].filter(Boolean) as string[],
          path: getRelativePath(hookFilePath, typeFilePath),
          isTypeOnly: true,
        },
      ],
    }
  }

  async getPost(path: string): Promise<File | null> {
    const { oas, directory, resolveId, clientPath, framework } = this.options

    const operation = oas.operation(path, 'post')

    if (!operation.schema.operationId) return null

    // hook setup
    const imports = this.getFrameworkSpecificImports(framework)
    const hookName = imports.getName(operation)
    const hookId = `${hookName}.ts`
    const hookFilePath = await resolveId({ fileName: hookId, directory, pluginName, options: { tag: operation.getTags()[0]?.name } })
    if (!hookFilePath) {
      return null
    }
    // end hook setup

    // type creation

    const schemas = this.getSchemas(operation)

    const typeName = `${pascalCase(operation.getOperationId(), { delimiter: '' })}.ts`
    const typeFilePath = await resolveId({ fileName: typeName, directory, pluginName: swaggerTypescriptPluginName })

    // hook creation

    const comments = this.getComments(operation)

    let url = operation.path
    let pathParamsTyped = ''

    if (schemas.pathParams) {
      // TODO move to it's own function(utils)
      url = url.replaceAll('{', '${')

      pathParamsTyped = Object.entries(schemas.pathParams.schema.properties!)
        .reduce((acc, [key, value], index, arr) => {
          acc.push(`${key}: ${schemas.pathParams!.name}["${key}"], `)

          return acc
        }, [] as string[])
        .join('')
    }

    const source = `
        ${createJSDocBlockText({ comments })}
        export function ${hookName} <TData = ${schemas.response.name}, TVariables = ${schemas.request.name}>(${pathParamsTyped} options?: {
          mutation?: ${imports.mutate.UseMutationOptions}<TData, unknown, TVariables>
        }) {
          const { mutation: mutationOptions } = options ?? {};

          return ${imports.mutate.useMutation}<TData, unknown, TVariables>({
            mutationFn: (data) => {
              return client<TData, TVariables>({
                method: "post",
                url: \`${url}\`,
                data,
              });
            },
            ...mutationOptions
          });
        };
    `

    return {
      path: hookFilePath,
      fileName: hookId,
      source,
      imports: [
        ...this.getQueryImports('mutate'),
        {
          name: 'client',
          path: clientPath ? getRelativePath(hookFilePath, clientPath) : '@kubb/swagger-client/client',
        },
        {
          name: [schemas.request.name, schemas.response.name, schemas.pathParams?.name, schemas.queryParams?.name].filter(Boolean) as string[],
          path: getRelativePath(hookFilePath, typeFilePath),
          isTypeOnly: true,
        },
      ],
    }

    // end hook creation
  }

  async getPut(path: string): Promise<File | null> {
    const { oas, directory, resolveId, clientPath, framework } = this.options

    const operation = oas.operation(path, 'put')

    if (!operation.schema.operationId) return null

    // hook setup
    const imports = this.getFrameworkSpecificImports(framework)
    const hookName = imports.getName(operation)
    const hookId = `${hookName}.ts`
    const hookFilePath = await resolveId({ fileName: hookId, directory, pluginName, options: { tag: operation.getTags()[0]?.name } })
    if (!hookFilePath) {
      return null
    }
    // end hook setup

    // type creation

    const schemas = this.getSchemas(operation)

    const typeName = `${pascalCase(operation.getOperationId(), { delimiter: '' })}.ts`
    const typeFilePath = await resolveId({ fileName: typeName, directory, pluginName: swaggerTypescriptPluginName })

    // hook creation

    const comments = this.getComments(operation)

    let url = operation.path
    let pathParamsTyped = ''

    if (schemas.pathParams) {
      // TODO move to it's own function(utils)
      url = url.replaceAll('{', '${')

      pathParamsTyped = Object.entries(schemas.pathParams.schema.properties!)
        .reduce((acc, [key, value], index, arr) => {
          acc.push(`${key}: ${schemas.pathParams!.name}["${key}"], `)

          return acc
        }, [] as string[])
        .join('')
    }

    const source = `
        ${createJSDocBlockText({ comments })}
        export function ${hookName} <TData = ${schemas.response.name}, TVariables = ${schemas.request.name}>(${pathParamsTyped} options?: {
          mutation?:  ${imports.mutate.UseMutationOptions}<TData, unknown, TVariables>
        }) {
          const { mutation: mutationOptions } = options ?? {};

          return ${imports.mutate.useMutation}<TData, unknown, TVariables>({
            mutationFn: (data) => {
              return client<TData, TVariables>({
                method: "put",
                url: \`${url}\`,
                data
              });
            },
            ...mutationOptions
          });
        };
    `

    return {
      path: hookFilePath,
      fileName: hookId,
      source,
      imports: [
        ...this.getQueryImports('mutate'),
        {
          name: 'client',
          path: clientPath ? getRelativePath(hookFilePath, clientPath) : '@kubb/swagger-client/client',
        },
        {
          name: [schemas.request.name, schemas.response.name, schemas.pathParams?.name, schemas.queryParams?.name].filter(Boolean) as string[],
          path: getRelativePath(hookFilePath, typeFilePath),
          isTypeOnly: true,
        },
      ],
    }

    // end hook creation
  }

  async getDelete(path: string): Promise<File | null> {
    const { oas, directory, resolveId, clientPath, framework } = this.options

    const operation = oas.operation(path, 'delete')

    if (!operation.schema.operationId) return null

    // hook setup
    const imports = this.getFrameworkSpecificImports(framework)
    const hookName = imports.getName(operation)
    const hookId = `${hookName}.ts`
    const hookFilePath = await resolveId({ fileName: hookId, directory, pluginName, options: { tag: operation.getTags()[0]?.name } })
    if (!hookFilePath) {
      return null
    }
    // end hook setup

    // type creation

    const schemas = this.getSchemas(operation)

    const typeName = `${pascalCase(operation.getOperationId(), { delimiter: '' })}.ts`
    const typeFilePath = await resolveId({ fileName: typeName, directory, pluginName: swaggerTypescriptPluginName })

    // hook creation

    const comments = this.getComments(operation)

    let url = operation.path
    let pathParamsTyped = ''

    if (schemas.pathParams) {
      // TODO move to it's own function(utils)
      url = url.replaceAll('{', '${')

      pathParamsTyped = Object.entries(schemas.pathParams.schema.properties!)
        .reduce((acc, [key, value], index, arr) => {
          acc.push(`${key}: ${schemas.pathParams!.name}["${key}"], `)

          return acc
        }, [] as string[])
        .join('')
    }

    const source = `
        ${createJSDocBlockText({ comments })}
        export function ${hookName} <TData = ${schemas.response.name}, TVariables = ${schemas.request.name}>(${pathParamsTyped} options?: {
          mutation?:  ${imports.mutate.UseMutationOptions}<TData, unknown, TVariables>
        }) {
          const { mutation: mutationOptions } = options ?? {};

          return ${imports.mutate.useMutation}<TData, unknown, TVariables>({
            mutationFn: () => {
              return client<TData, TVariables>({
                method: "delete",
                url: \`${url}\`
              });
            },
            ...mutationOptions
          });
        };
    `

    return {
      path: hookFilePath,
      fileName: hookId,
      source,
      imports: [
        ...this.getQueryImports('mutate'),
        {
          name: 'client',
          path: clientPath ? getRelativePath(hookFilePath, clientPath) : '@kubb/swagger-client/client',
        },
        {
          name: [schemas.request.name, schemas.response.name, schemas.pathParams?.name, schemas.queryParams?.name].filter(Boolean) as string[],
          path: getRelativePath(hookFilePath, typeFilePath),
          isTypeOnly: true,
        },
      ],
    }

    // end hook creation
  }

  async build() {
    return this.buildOperations({
      fileManager: this.options.fileManager,
      oas: this.options.oas,
    })
  }
}