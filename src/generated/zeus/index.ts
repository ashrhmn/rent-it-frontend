/* eslint-disable */

import { AllTypesProps, ReturnTypes, Ops } from './const';
export const HOST = "http://localhost:4000/graphql"


export const HEADERS = {}
export const apiSubscription = (options: chainOptions) => (query: string) => {
  try {
    const queryString = options[0] + '?query=' + encodeURIComponent(query);
    const wsString = queryString.replace('http', 'ws');
    const host = (options.length > 1 && options[1]?.websocket?.[0]) || wsString;
    const webSocketOptions = options[1]?.websocket || [host];
    const ws = new WebSocket(...webSocketOptions);
    return {
      ws,
      on: (e: (args: any) => void) => {
        ws.onmessage = (event: any) => {
          if (event.data) {
            const parsed = JSON.parse(event.data);
            const data = parsed.data;
            return e(data);
          }
        };
      },
      off: (e: (args: any) => void) => {
        ws.onclose = e;
      },
      error: (e: (args: any) => void) => {
        ws.onerror = e;
      },
      open: (e: () => void) => {
        ws.onopen = e;
      },
    };
  } catch {
    throw new Error('No websockets implemented');
  }
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json() as Promise<GraphQLResponse>;
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === 'GET') {
      return fetch(`${options[0]}?query=${encodeURIComponent(query)}`, fetchOptions)
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = '',
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return '';
    }
    if (typeof o === 'boolean' || typeof o === 'number') {
      return k;
    }
    if (typeof o === 'string') {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join('\n');
    }
    const hasOperationName = root && options?.operationName ? ' ' + options.operationName : '';
    const keyForDirectives = o.__directives ?? '';
    const query = `{${Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map((e) => ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars))
      .join('\n')}}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars.map((v) => `${v.name}: ${v.graphQLType}`).join(', ');
    return `${k} ${keyForDirectives}${hasOperationName}${varsString ? `(${varsString})` : ''} ${query}`;
  };
  return ibb;
};

export const Thunder =
  (fn: FetchFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: Record<string, unknown> }) =>
    fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
      ops?.variables,
    ).then((data) => {
      if (graphqlOptions?.scalars) {
        return decodeScalarsInResponse({
          response: data,
          initialOp: operation,
          initialZeusQuery: o as VType,
          returns: ReturnTypes,
          scalars: graphqlOptions.scalars,
          ops: Ops,
        });
      }
      return data;
    }) as Promise<InputType<GraphQLTypes[R], Z, SCLR>>;

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder =
  (fn: SubscriptionFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: ExtractVariables<Z> }) => {
    const returnedFunction = fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
    ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], SCLR>;
    if (returnedFunction?.on && graphqlOptions?.scalars) {
      const wrapped = returnedFunction.on;
      returnedFunction.on = (fnToCall: (args: InputType<GraphQLTypes[R], Z, SCLR>) => void) =>
        wrapped((data: InputType<GraphQLTypes[R], Z, SCLR>) => {
          if (graphqlOptions?.scalars) {
            return fnToCall(
              decodeScalarsInResponse({
                response: data,
                initialOp: operation,
                initialZeusQuery: o as VType,
                returns: ReturnTypes,
                scalars: graphqlOptions.scalars,
                ops: Ops,
              }),
            );
          }
          return fnToCall(data);
        });
    }
    return returnedFunction;
  };

export const Subscription = (...options: chainOptions) => SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: Z | ValueTypes[R],
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    'Content-Type': 'application/json',
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(initialOp as string, ops[initialOp], initialZeusQuery);
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })(initialOp as string, response, [ops[initialOp]]);
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (k: string, o: InputValueType | VType, p: string[] = []): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    if (o == null) {
      return o;
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder = resolvers[currentScalarString.split('.')[1]]?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string' || !o) {
      return o;
    }
    const entries = Object.entries(o).map(([k, v]) => [k, ibb(k, v, [...p, purifyGraphQLKey(k)])] as const);
    const objectFromEntries = entries.reduce<Record<string, unknown>>((a, [k, v]) => {
      a[k] = v;
      return a;
    }, {});
    return objectFromEntries;
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | 'enum'
    | {
        [x: string]:
          | undefined
          | string
          | {
              [x: string]: string | undefined;
            };
      };
};

export type ReturnTypesType = {
  [x: string]:
    | {
        [x: string]: string | undefined;
      }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]: undefined | boolean | string | number | [any, undefined | boolean | InputValueType] | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
      [x: string]: ZeusArgsType;
    }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = '|';

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends new (...args: infer R) => WebSocket ? R : never;
export type chainOptions = [fetchOptions[0], fetchOptions[1] & { websocket?: websocketOptions }] | [fetchOptions[0]];
export type FetchFunction = (query: string, variables?: Record<string, unknown>) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<F extends [infer ARGS, any] ? ARGS : undefined>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super('');
    console.error(response);
  }
  toString() {
    return 'GraphQL Response Error';
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops ? typeof Ops[O] : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (mappedParts: string[], returns: ReturnTypesType): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === 'object') {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = ({ ops, returns }: { returns: ReturnTypesType; ops: Operations }) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string') {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith('scalar')) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map(([k, v]) => {
        // Inline fragments shouldn't be added to the path as they aren't a field
        const isInlineFragment = originalKey.match(/^...\s*on/) != null;
        return ibb(
          k,
          k,
          v,
          isInlineFragment ? p : [...p, purifyGraphQLKey(keyName || k)],
          isInlineFragment ? pOriginals : [...pOriginals, purifyGraphQLKey(originalKey)],
          false,
        );
      })
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) => k.replace(/\([^)]*\)/g, '').replace(/^[^:]*\:/g, '');

const mapPart = (p: string) => {
  const [isArg, isField] = p.split('<>');
  if (isField) {
    return {
      v: isField,
      __type: 'field',
    } as const;
  }
  return {
    v: isArg,
    __type: 'arg',
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (props: AllTypesPropsType, returns: ReturnTypesType, ops: Operations) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === 'enum' && mappedParts.length === 1) {
      return 'enum';
    }
    if (typeof propsP1 === 'string' && propsP1.startsWith('scalar.') && mappedParts.length === 1) {
      return propsP1;
    }
    if (typeof propsP1 === 'object') {
      if (mappedParts.length < 2) {
        return 'not';
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === 'string') {
        return rpp(
          `${propsP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
      if (typeof propsP2 === 'object') {
        if (mappedParts.length < 3) {
          return 'not';
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === 'arg') {
          return rpp(
            `${propsP3}${SEPARATOR}${mappedParts
              .slice(3)
              .map((mp) => mp.v)
              .join(SEPARATOR)}`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return 'not';
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === 'object') {
      if (mappedParts.length < 2) return 'not';
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
    }
  };
  const rpp = (path: string): 'enum' | 'not' | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return 'not';
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = '', root = true): string => {
    if (typeof a === 'string') {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a.replace(START_VAR_NAME, '$').split(GRAPHQL_TYPE_SEPARATOR);
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith('scalar.')) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split('.');
      const scalarKey = splittedScalar.join('.');
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(', ')}]`;
    }
    if (typeof a === 'string') {
      if (checkType === 'enum') {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === 'object') {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== 'undefined')
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(',\n');
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <X, T extends keyof ResolverInputTypes, Z extends keyof ResolverInputTypes[T]>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any] ? Input : any,
    source: any,
  ) => Z extends keyof ModelTypes[T] ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X : never,
) => fn as (args?: any, source?: any) => ReturnType<typeof fn>;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<UnwrapPromise<ReturnType<T>>>;
export type ZeusHook<
  T extends (...args: any[]) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends 'scalar' & { name: infer T }
  ? T extends keyof SCLR
    ? SCLR[T]['decode'] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]['decode']>
      : unknown
    : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<SRC extends DeepAnify<DST>, DST, SCLR extends ScalarDefinition> = FlattenArray<SRC> extends
  | ZEUS_INTERFACES
  | ZEUS_UNIONS
  ? {
      [P in keyof SRC]: SRC[P] extends '__union' & infer R
        ? P extends keyof DST
          ? IsArray<R, '__typename' extends keyof DST ? DST[P] & { __typename: true } : DST[P], SCLR>
          : IsArray<R, '__typename' extends keyof DST ? { __typename: true } : never, SCLR>
        : never;
    }[keyof SRC] & {
      [P in keyof Omit<
        Pick<
          SRC,
          {
            [P in keyof DST]: SRC[P] extends '__union' & infer R ? never : P;
          }[keyof DST]
        >,
        '__typename'
      >]: IsPayLoad<DST[P]> extends BaseZeusResolver ? IsScalar<SRC[P], SCLR> : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
      [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<DST[P]> extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    };

export type MapType<SRC, DST, SCLR extends ScalarDefinition> = SRC extends DeepAnify<DST>
  ? IsInterfaced<SRC, DST, SCLR>
  : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<SRC, DST, SCLR extends ScalarDefinition = {}> = IsPayLoad<DST> extends { __alias: infer R }
  ? {
      [P in keyof R]: MapType<SRC, R[P], SCLR>[keyof MapType<SRC, R[P], SCLR>];
    } & MapType<SRC, Omit<IsPayLoad<DST>, '__alias'>, SCLR>
  : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (fn: (e: { data?: InputType<T, Z, SCLR>; code?: number; reason?: string; message?: string }) => void) => void;
  error: (fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<SELECTOR, NAME extends keyof GraphQLTypes, SCLR extends ScalarDefinition = {}> = InputType<
  GraphQLTypes[NAME],
  SELECTOR,
  SCLR
>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <T>(t: T | V) => T;

type BuiltInVariableTypes = {
  ['String']: string;
  ['Int']: number;
  ['Float']: number;
  ['ID']: unknown;
  ['Boolean']: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> = `${T}!` | T | `[${T}]` | `[${T}]!` | `[${T}!]` | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4>
        ? R4 extends VR<infer R5>
          ? R5
          : R4
        : R3
      : R2
    : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!`
  ? NonNullable<DecomposeType<R, Type>>
  : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> = T extends keyof ZEUS_VARIABLES
  ? ZEUS_VARIABLES[T]
  : T extends keyof BuiltInVariableTypes
  ? BuiltInVariableTypes[T]
  : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> = OptionalKeys<WithNullableKeys<T>> & WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  ' __zeus_name': Name;
  ' __zeus_type': T;
};

export type ExtractVariables<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
  ? ExtractVariables<Inputs> & ExtractVariables<Outputs>
  : Query extends string | number | boolean
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariables<Query[K]>> }[keyof Query]>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(name: Name, graphqlType: Type) => {
  return (START_VAR_NAME + name + GRAPHQL_TYPE_SEPARATOR + graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES = never
export type ScalarCoders = {
	DateTime?: ScalarResolver;
}
type ZEUS_UNIONS = never

export type ValueTypes = {
    ["CreateProfileInput"]: {
	bio?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	property_city?: string | undefined | null | Variable<any, string>,
	property_house_number?: string | undefined | null | Variable<any, string>,
	property_postcode?: string | undefined | null | Variable<any, string>,
	property_state?: string | undefined | null | Variable<any, string>,
	property_street_address?: string | undefined | null | Variable<any, string>,
	type: ValueTypes["profile_type"] | Variable<any, string>
};
	["CreateReviewDto"]: {
	category: ValueTypes["review_category"] | Variable<any, string>,
	comment?: string | undefined | null | Variable<any, string>,
	profile_id: string | Variable<any, string>,
	stars?: number | undefined | null | Variable<any, string>
};
	["CreateTenantFormDto"]: {
	duration_in_months: number | Variable<any, string>,
	email: string | Variable<any, string>,
	name: string | Variable<any, string>,
	phone: string | Variable<any, string>,
	surname: string | Variable<any, string>
};
	["CurrentUserResponseDto"]: AliasType<{
	email?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	permissions?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
["DateTime"]:unknown;
	["DateTimeFilter"]: {
	equals?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["DateTime"]> | undefined | null | Variable<any, string>,
	lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedDateTimeFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["DateTime"]> | undefined | null | Variable<any, string>
};
	["DateTimeNullableFilter"]: {
	equals?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["DateTime"]> | undefined | null | Variable<any, string>,
	lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedDateTimeNullableFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["DateTime"]> | undefined | null | Variable<any, string>
};
	["EnumpermissionNullableListFilter"]: {
	equals?: Array<ValueTypes["permission"]> | undefined | null | Variable<any, string>,
	has?: ValueTypes["permission"] | undefined | null | Variable<any, string>,
	hasEvery?: Array<ValueTypes["permission"]> | undefined | null | Variable<any, string>,
	hasSome?: Array<ValueTypes["permission"]> | undefined | null | Variable<any, string>,
	isEmpty?: boolean | undefined | null | Variable<any, string>
};
	["Enumprofile_typeFilter"]: {
	equals?: ValueTypes["profile_type"] | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["profile_type"]> | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedEnumprofile_typeFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["profile_type"]> | undefined | null | Variable<any, string>
};
	["Enumreview_categoryFilter"]: {
	equals?: ValueTypes["review_category"] | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["review_category"]> | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedEnumreview_categoryFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["review_category"]> | undefined | null | Variable<any, string>
};
	["IntFilter"]: {
	equals?: number | undefined | null | Variable<any, string>,
	gt?: number | undefined | null | Variable<any, string>,
	gte?: number | undefined | null | Variable<any, string>,
	in?: Array<number> | undefined | null | Variable<any, string>,
	lt?: number | undefined | null | Variable<any, string>,
	lte?: number | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedIntFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<number> | undefined | null | Variable<any, string>
};
	["IntNullableFilter"]: {
	equals?: number | undefined | null | Variable<any, string>,
	gt?: number | undefined | null | Variable<any, string>,
	gte?: number | undefined | null | Variable<any, string>,
	in?: Array<number> | undefined | null | Variable<any, string>,
	lt?: number | undefined | null | Variable<any, string>,
	lte?: number | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedIntNullableFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<number> | undefined | null | Variable<any, string>
};
	["LoginDto"]: {
	password: string | Variable<any, string>,
	usernameOrEmail: string | Variable<any, string>
};
	["LoginResponseDto"]: AliasType<{
	accessToken?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Mutation"]: AliasType<{
createProfile?: [{	data: ValueTypes["CreateProfileInput"] | Variable<any, string>},boolean | `@${string}`],
createReview?: [{	data: ValueTypes["CreateReviewDto"] | Variable<any, string>},boolean | `@${string}`],
createTenantFormSubmission?: [{	data: ValueTypes["CreateTenantFormDto"] | Variable<any, string>},boolean | `@${string}`],
createUser?: [{	data: ValueTypes["usersCreateInput"] | Variable<any, string>},ValueTypes["users"]],
	logout?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
signUp?: [{	data: ValueTypes["SignUpDto"] | Variable<any, string>},boolean | `@${string}`],
		__typename?: boolean | `@${string}`
}>;
	["NestedDateTimeFilter"]: {
	equals?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["DateTime"]> | undefined | null | Variable<any, string>,
	lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedDateTimeFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["DateTime"]> | undefined | null | Variable<any, string>
};
	["NestedDateTimeNullableFilter"]: {
	equals?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["DateTime"]> | undefined | null | Variable<any, string>,
	lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedDateTimeNullableFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["DateTime"]> | undefined | null | Variable<any, string>
};
	["NestedEnumprofile_typeFilter"]: {
	equals?: ValueTypes["profile_type"] | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["profile_type"]> | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedEnumprofile_typeFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["profile_type"]> | undefined | null | Variable<any, string>
};
	["NestedEnumreview_categoryFilter"]: {
	equals?: ValueTypes["review_category"] | undefined | null | Variable<any, string>,
	in?: Array<ValueTypes["review_category"]> | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedEnumreview_categoryFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<ValueTypes["review_category"]> | undefined | null | Variable<any, string>
};
	["NestedIntFilter"]: {
	equals?: number | undefined | null | Variable<any, string>,
	gt?: number | undefined | null | Variable<any, string>,
	gte?: number | undefined | null | Variable<any, string>,
	in?: Array<number> | undefined | null | Variable<any, string>,
	lt?: number | undefined | null | Variable<any, string>,
	lte?: number | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedIntFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<number> | undefined | null | Variable<any, string>
};
	["NestedIntNullableFilter"]: {
	equals?: number | undefined | null | Variable<any, string>,
	gt?: number | undefined | null | Variable<any, string>,
	gte?: number | undefined | null | Variable<any, string>,
	in?: Array<number> | undefined | null | Variable<any, string>,
	lt?: number | undefined | null | Variable<any, string>,
	lte?: number | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedIntNullableFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<number> | undefined | null | Variable<any, string>
};
	["NestedStringFilter"]: {
	contains?: string | undefined | null | Variable<any, string>,
	endsWith?: string | undefined | null | Variable<any, string>,
	equals?: string | undefined | null | Variable<any, string>,
	gt?: string | undefined | null | Variable<any, string>,
	gte?: string | undefined | null | Variable<any, string>,
	in?: Array<string> | undefined | null | Variable<any, string>,
	lt?: string | undefined | null | Variable<any, string>,
	lte?: string | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedStringFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<string> | undefined | null | Variable<any, string>,
	startsWith?: string | undefined | null | Variable<any, string>
};
	["NestedStringNullableFilter"]: {
	contains?: string | undefined | null | Variable<any, string>,
	endsWith?: string | undefined | null | Variable<any, string>,
	equals?: string | undefined | null | Variable<any, string>,
	gt?: string | undefined | null | Variable<any, string>,
	gte?: string | undefined | null | Variable<any, string>,
	in?: Array<string> | undefined | null | Variable<any, string>,
	lt?: string | undefined | null | Variable<any, string>,
	lte?: string | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedStringNullableFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<string> | undefined | null | Variable<any, string>,
	startsWith?: string | undefined | null | Variable<any, string>
};
	["NullsOrder"]:NullsOrder;
	["PostsCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	media?:boolean | `@${string}`,
	profile_id?:boolean | `@${string}`,
	title?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PostsListRelationFilter"]: {
	every?: ValueTypes["postsWhereInput"] | undefined | null | Variable<any, string>,
	none?: ValueTypes["postsWhereInput"] | undefined | null | Variable<any, string>,
	some?: ValueTypes["postsWhereInput"] | undefined | null | Variable<any, string>
};
	["PostsMaxAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	profile_id?:boolean | `@${string}`,
	title?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PostsMinAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	profile_id?:boolean | `@${string}`,
	title?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesCount"]: AliasType<{
	posts?:boolean | `@${string}`,
	received_reviews?:boolean | `@${string}`,
	sent_reviews?:boolean | `@${string}`,
	tenant_form_submissions?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	bio?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	property_city?:boolean | `@${string}`,
	property_house_number?:boolean | `@${string}`,
	property_postcode?:boolean | `@${string}`,
	property_state?:boolean | `@${string}`,
	property_street_address?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	user_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesListRelationFilter"]: {
	every?: ValueTypes["profilesWhereInput"] | undefined | null | Variable<any, string>,
	none?: ValueTypes["profilesWhereInput"] | undefined | null | Variable<any, string>,
	some?: ValueTypes["profilesWhereInput"] | undefined | null | Variable<any, string>
};
	["ProfilesMaxAggregate"]: AliasType<{
	bio?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	property_city?:boolean | `@${string}`,
	property_house_number?:boolean | `@${string}`,
	property_postcode?:boolean | `@${string}`,
	property_state?:boolean | `@${string}`,
	property_street_address?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	user_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesMinAggregate"]: AliasType<{
	bio?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	property_city?:boolean | `@${string}`,
	property_house_number?:boolean | `@${string}`,
	property_postcode?:boolean | `@${string}`,
	property_state?:boolean | `@${string}`,
	property_street_address?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	user_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesRelationFilter"]: {
	is?: ValueTypes["profilesWhereInput"] | undefined | null | Variable<any, string>,
	isNot?: ValueTypes["profilesWhereInput"] | undefined | null | Variable<any, string>
};
	["ProfilesScalarFieldEnum"]:ProfilesScalarFieldEnum;
	["Query"]: AliasType<{
	currentUser?:ValueTypes["CurrentUserResponseDto"],
getAllReviewsByProfileId?: [{	profile_id: string | Variable<any, string>},ValueTypes["ReviewByProfileResponseDto"]],
getAllUsers?: [{	cursor?: ValueTypes["usersWhereUniqueInput"] | undefined | null | Variable<any, string>,	distinct?: Array<ValueTypes["UsersScalarFieldEnum"]> | undefined | null | Variable<any, string>,	orderBy?: Array<ValueTypes["usersOrderByWithRelationInput"]> | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	take?: number | undefined | null | Variable<any, string>,	where?: ValueTypes["usersWhereInput"] | undefined | null | Variable<any, string>},ValueTypes["users"]],
getProfile?: [{	cursor?: ValueTypes["profilesWhereUniqueInput"] | undefined | null | Variable<any, string>,	distinct?: Array<ValueTypes["ProfilesScalarFieldEnum"]> | undefined | null | Variable<any, string>,	orderBy?: Array<ValueTypes["profilesOrderByWithRelationInput"]> | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	take?: number | undefined | null | Variable<any, string>,	where?: ValueTypes["profilesWhereInput"] | undefined | null | Variable<any, string>},ValueTypes["profiles"]],
getProfiles?: [{	cursor?: ValueTypes["profilesWhereUniqueInput"] | undefined | null | Variable<any, string>,	distinct?: Array<ValueTypes["ProfilesScalarFieldEnum"]> | undefined | null | Variable<any, string>,	orderBy?: Array<ValueTypes["profilesOrderByWithRelationInput"]> | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	take?: number | undefined | null | Variable<any, string>,	where?: ValueTypes["profilesWhereInput"] | undefined | null | Variable<any, string>},ValueTypes["profiles"]],
	getReviewCategories?:boolean | `@${string}`,
getReviewsOnProfileByLoggedInUser?: [{	profile_id: string | Variable<any, string>},ValueTypes["reviews"]],
login?: [{	data: ValueTypes["LoginDto"] | Variable<any, string>},ValueTypes["LoginResponseDto"]],
		__typename?: boolean | `@${string}`
}>;
	["QueryMode"]:QueryMode;
	["ReviewByProfileResponseDto"]: AliasType<{
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	sent_reviews?:ValueTypes["reviews_scaler_type"],
		__typename?: boolean | `@${string}`
}>;
	["ReviewsAvgAggregate"]: AliasType<{
	stars?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReviewsCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReviewsListRelationFilter"]: {
	every?: ValueTypes["reviewsWhereInput"] | undefined | null | Variable<any, string>,
	none?: ValueTypes["reviewsWhereInput"] | undefined | null | Variable<any, string>,
	some?: ValueTypes["reviewsWhereInput"] | undefined | null | Variable<any, string>
};
	["ReviewsMaxAggregate"]: AliasType<{
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReviewsMinAggregate"]: AliasType<{
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReviewsSumAggregate"]: AliasType<{
	stars?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["SignUpDto"]: {
	confirmPassword: string | Variable<any, string>,
	dateOfBirth: number | Variable<any, string>,
	email: string | Variable<any, string>,
	password: string | Variable<any, string>,
	username: string | Variable<any, string>
};
	["SortOrder"]:SortOrder;
	["SortOrderInput"]: {
	nulls?: ValueTypes["NullsOrder"] | undefined | null | Variable<any, string>,
	sort: ValueTypes["SortOrder"] | Variable<any, string>
};
	["StringFilter"]: {
	contains?: string | undefined | null | Variable<any, string>,
	endsWith?: string | undefined | null | Variable<any, string>,
	equals?: string | undefined | null | Variable<any, string>,
	gt?: string | undefined | null | Variable<any, string>,
	gte?: string | undefined | null | Variable<any, string>,
	in?: Array<string> | undefined | null | Variable<any, string>,
	lt?: string | undefined | null | Variable<any, string>,
	lte?: string | undefined | null | Variable<any, string>,
	mode?: ValueTypes["QueryMode"] | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedStringFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<string> | undefined | null | Variable<any, string>,
	startsWith?: string | undefined | null | Variable<any, string>
};
	["StringNullableFilter"]: {
	contains?: string | undefined | null | Variable<any, string>,
	endsWith?: string | undefined | null | Variable<any, string>,
	equals?: string | undefined | null | Variable<any, string>,
	gt?: string | undefined | null | Variable<any, string>,
	gte?: string | undefined | null | Variable<any, string>,
	in?: Array<string> | undefined | null | Variable<any, string>,
	lt?: string | undefined | null | Variable<any, string>,
	lte?: string | undefined | null | Variable<any, string>,
	mode?: ValueTypes["QueryMode"] | undefined | null | Variable<any, string>,
	not?: ValueTypes["NestedStringNullableFilter"] | undefined | null | Variable<any, string>,
	notIn?: Array<string> | undefined | null | Variable<any, string>,
	startsWith?: string | undefined | null | Variable<any, string>
};
	["StringNullableListFilter"]: {
	equals?: Array<string> | undefined | null | Variable<any, string>,
	has?: string | undefined | null | Variable<any, string>,
	hasEvery?: Array<string> | undefined | null | Variable<any, string>,
	hasSome?: Array<string> | undefined | null | Variable<any, string>,
	isEmpty?: boolean | undefined | null | Variable<any, string>
};
	["Tenant_form_submissionsAvgAggregate"]: AliasType<{
	duration_in_months?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tenant_form_submissionsCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	duration_in_months?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	from_profile_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	surname?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tenant_form_submissionsListRelationFilter"]: {
	every?: ValueTypes["tenant_form_submissionsWhereInput"] | undefined | null | Variable<any, string>,
	none?: ValueTypes["tenant_form_submissionsWhereInput"] | undefined | null | Variable<any, string>,
	some?: ValueTypes["tenant_form_submissionsWhereInput"] | undefined | null | Variable<any, string>
};
	["Tenant_form_submissionsMaxAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	duration_in_months?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	from_profile_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	surname?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tenant_form_submissionsMinAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	duration_in_months?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	from_profile_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	surname?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tenant_form_submissionsSumAggregate"]: AliasType<{
	duration_in_months?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersAvgAggregate"]: AliasType<{
	date_of_birth?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersCount"]: AliasType<{
	profiles?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	date_of_birth?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	email_verified_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	password?:boolean | `@${string}`,
	permissions?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersMaxAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	date_of_birth?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	email_verified_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	password?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersMinAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	date_of_birth?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	email_verified_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	password?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersRelationFilter"]: {
	is?: ValueTypes["usersWhereInput"] | undefined | null | Variable<any, string>,
	isNot?: ValueTypes["usersWhereInput"] | undefined | null | Variable<any, string>
};
	["UsersScalarFieldEnum"]:UsersScalarFieldEnum;
	["UsersSumAggregate"]: AliasType<{
	date_of_birth?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["permission"]:permission;
	["posts"]: AliasType<{
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	media?:boolean | `@${string}`,
	profile_id?:boolean | `@${string}`,
	profiles?:ValueTypes["profiles"],
	title?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["postsCreateManyProfilesInput"]: {
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	description: string | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	media?: ValueTypes["postsCreatemediaInput"] | undefined | null | Variable<any, string>,
	title: string | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["postsCreateManyProfilesInputEnvelope"]: {
	data: Array<ValueTypes["postsCreateManyProfilesInput"]> | Variable<any, string>,
	skipDuplicates?: boolean | undefined | null | Variable<any, string>
};
	["postsCreateNestedManyWithoutProfilesInput"]: {
	connect?: Array<ValueTypes["postsWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	connectOrCreate?: Array<ValueTypes["postsCreateOrConnectWithoutProfilesInput"]> | undefined | null | Variable<any, string>,
	create?: Array<ValueTypes["postsCreateWithoutProfilesInput"]> | undefined | null | Variable<any, string>,
	createMany?: ValueTypes["postsCreateManyProfilesInputEnvelope"] | undefined | null | Variable<any, string>
};
	["postsCreateOrConnectWithoutProfilesInput"]: {
	create: ValueTypes["postsCreateWithoutProfilesInput"] | Variable<any, string>,
	where: ValueTypes["postsWhereUniqueInput"] | Variable<any, string>
};
	["postsCreateWithoutProfilesInput"]: {
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	description: string | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	media?: ValueTypes["postsCreatemediaInput"] | undefined | null | Variable<any, string>,
	title: string | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["postsCreatemediaInput"]: {
	set: Array<string> | Variable<any, string>
};
	["postsOrderByRelationAggregateInput"]: {
	_count?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>
};
	["postsWhereInput"]: {
	AND?: Array<ValueTypes["postsWhereInput"]> | undefined | null | Variable<any, string>,
	NOT?: Array<ValueTypes["postsWhereInput"]> | undefined | null | Variable<any, string>,
	OR?: Array<ValueTypes["postsWhereInput"]> | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	media?: ValueTypes["StringNullableListFilter"] | undefined | null | Variable<any, string>,
	profile_id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	profiles?: ValueTypes["ProfilesRelationFilter"] | undefined | null | Variable<any, string>,
	title?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>
};
	["postsWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>
};
	["profile_type"]:profile_type;
	["profiles"]: AliasType<{
	_count?:ValueTypes["ProfilesCount"],
	bio?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	posts?:ValueTypes["posts"],
	property_city?:boolean | `@${string}`,
	property_house_number?:boolean | `@${string}`,
	property_postcode?:boolean | `@${string}`,
	property_state?:boolean | `@${string}`,
	property_street_address?:boolean | `@${string}`,
	received_reviews?:ValueTypes["reviews"],
	sent_reviews?:ValueTypes["reviews"],
	tenant_form_submissions?:ValueTypes["tenant_form_submissions"],
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	user?:ValueTypes["users"],
	user_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["profilesCreateManyUserInput"]: {
	bio?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	property_city?: string | undefined | null | Variable<any, string>,
	property_house_number?: string | undefined | null | Variable<any, string>,
	property_postcode?: string | undefined | null | Variable<any, string>,
	property_state?: string | undefined | null | Variable<any, string>,
	property_street_address?: string | undefined | null | Variable<any, string>,
	type: ValueTypes["profile_type"] | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["profilesCreateManyUserInputEnvelope"]: {
	data: Array<ValueTypes["profilesCreateManyUserInput"]> | Variable<any, string>,
	skipDuplicates?: boolean | undefined | null | Variable<any, string>
};
	["profilesCreateNestedManyWithoutUserInput"]: {
	connect?: Array<ValueTypes["profilesWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	connectOrCreate?: Array<ValueTypes["profilesCreateOrConnectWithoutUserInput"]> | undefined | null | Variable<any, string>,
	create?: Array<ValueTypes["profilesCreateWithoutUserInput"]> | undefined | null | Variable<any, string>,
	createMany?: ValueTypes["profilesCreateManyUserInputEnvelope"] | undefined | null | Variable<any, string>
};
	["profilesCreateNestedOneWithoutReceived_reviewsInput"]: {
	connect?: ValueTypes["profilesWhereUniqueInput"] | undefined | null | Variable<any, string>,
	connectOrCreate?: ValueTypes["profilesCreateOrConnectWithoutReceived_reviewsInput"] | undefined | null | Variable<any, string>,
	create?: ValueTypes["profilesCreateWithoutReceived_reviewsInput"] | undefined | null | Variable<any, string>
};
	["profilesCreateNestedOneWithoutSent_reviewsInput"]: {
	connect?: ValueTypes["profilesWhereUniqueInput"] | undefined | null | Variable<any, string>,
	connectOrCreate?: ValueTypes["profilesCreateOrConnectWithoutSent_reviewsInput"] | undefined | null | Variable<any, string>,
	create?: ValueTypes["profilesCreateWithoutSent_reviewsInput"] | undefined | null | Variable<any, string>
};
	["profilesCreateOrConnectWithoutReceived_reviewsInput"]: {
	create: ValueTypes["profilesCreateWithoutReceived_reviewsInput"] | Variable<any, string>,
	where: ValueTypes["profilesWhereUniqueInput"] | Variable<any, string>
};
	["profilesCreateOrConnectWithoutSent_reviewsInput"]: {
	create: ValueTypes["profilesCreateWithoutSent_reviewsInput"] | Variable<any, string>,
	where: ValueTypes["profilesWhereUniqueInput"] | Variable<any, string>
};
	["profilesCreateOrConnectWithoutUserInput"]: {
	create: ValueTypes["profilesCreateWithoutUserInput"] | Variable<any, string>,
	where: ValueTypes["profilesWhereUniqueInput"] | Variable<any, string>
};
	["profilesCreateWithoutReceived_reviewsInput"]: {
	bio?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	posts?: ValueTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined | null | Variable<any, string>,
	property_city?: string | undefined | null | Variable<any, string>,
	property_house_number?: string | undefined | null | Variable<any, string>,
	property_postcode?: string | undefined | null | Variable<any, string>,
	property_state?: string | undefined | null | Variable<any, string>,
	property_street_address?: string | undefined | null | Variable<any, string>,
	sent_reviews?: ValueTypes["reviewsCreateNestedManyWithoutSent_by_profileInput"] | undefined | null | Variable<any, string>,
	tenant_form_submissions?: ValueTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined | null | Variable<any, string>,
	type: ValueTypes["profile_type"] | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	user: ValueTypes["usersCreateNestedOneWithoutProfilesInput"] | Variable<any, string>
};
	["profilesCreateWithoutSent_reviewsInput"]: {
	bio?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	posts?: ValueTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined | null | Variable<any, string>,
	property_city?: string | undefined | null | Variable<any, string>,
	property_house_number?: string | undefined | null | Variable<any, string>,
	property_postcode?: string | undefined | null | Variable<any, string>,
	property_state?: string | undefined | null | Variable<any, string>,
	property_street_address?: string | undefined | null | Variable<any, string>,
	received_reviews?: ValueTypes["reviewsCreateNestedManyWithoutReceived_by_profileInput"] | undefined | null | Variable<any, string>,
	tenant_form_submissions?: ValueTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined | null | Variable<any, string>,
	type: ValueTypes["profile_type"] | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	user: ValueTypes["usersCreateNestedOneWithoutProfilesInput"] | Variable<any, string>
};
	["profilesCreateWithoutUserInput"]: {
	bio?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	posts?: ValueTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined | null | Variable<any, string>,
	property_city?: string | undefined | null | Variable<any, string>,
	property_house_number?: string | undefined | null | Variable<any, string>,
	property_postcode?: string | undefined | null | Variable<any, string>,
	property_state?: string | undefined | null | Variable<any, string>,
	property_street_address?: string | undefined | null | Variable<any, string>,
	received_reviews?: ValueTypes["reviewsCreateNestedManyWithoutReceived_by_profileInput"] | undefined | null | Variable<any, string>,
	sent_reviews?: ValueTypes["reviewsCreateNestedManyWithoutSent_by_profileInput"] | undefined | null | Variable<any, string>,
	tenant_form_submissions?: ValueTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined | null | Variable<any, string>,
	type: ValueTypes["profile_type"] | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["profilesOrderByRelationAggregateInput"]: {
	_count?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>
};
	["profilesOrderByWithRelationInput"]: {
	bio?: ValueTypes["SortOrderInput"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["SortOrderInput"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	posts?: ValueTypes["postsOrderByRelationAggregateInput"] | undefined | null | Variable<any, string>,
	property_city?: ValueTypes["SortOrderInput"] | undefined | null | Variable<any, string>,
	property_house_number?: ValueTypes["SortOrderInput"] | undefined | null | Variable<any, string>,
	property_postcode?: ValueTypes["SortOrderInput"] | undefined | null | Variable<any, string>,
	property_state?: ValueTypes["SortOrderInput"] | undefined | null | Variable<any, string>,
	property_street_address?: ValueTypes["SortOrderInput"] | undefined | null | Variable<any, string>,
	received_reviews?: ValueTypes["reviewsOrderByRelationAggregateInput"] | undefined | null | Variable<any, string>,
	sent_reviews?: ValueTypes["reviewsOrderByRelationAggregateInput"] | undefined | null | Variable<any, string>,
	tenant_form_submissions?: ValueTypes["tenant_form_submissionsOrderByRelationAggregateInput"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["usersOrderByWithRelationInput"] | undefined | null | Variable<any, string>,
	user_id?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>
};
	["profilesUser_idTypeCompoundUniqueInput"]: {
	type: ValueTypes["profile_type"] | Variable<any, string>,
	user_id: string | Variable<any, string>
};
	["profilesWhereInput"]: {
	AND?: Array<ValueTypes["profilesWhereInput"]> | undefined | null | Variable<any, string>,
	NOT?: Array<ValueTypes["profilesWhereInput"]> | undefined | null | Variable<any, string>,
	OR?: Array<ValueTypes["profilesWhereInput"]> | undefined | null | Variable<any, string>,
	bio?: ValueTypes["StringNullableFilter"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>,
	description?: ValueTypes["StringNullableFilter"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	posts?: ValueTypes["PostsListRelationFilter"] | undefined | null | Variable<any, string>,
	property_city?: ValueTypes["StringNullableFilter"] | undefined | null | Variable<any, string>,
	property_house_number?: ValueTypes["StringNullableFilter"] | undefined | null | Variable<any, string>,
	property_postcode?: ValueTypes["StringNullableFilter"] | undefined | null | Variable<any, string>,
	property_state?: ValueTypes["StringNullableFilter"] | undefined | null | Variable<any, string>,
	property_street_address?: ValueTypes["StringNullableFilter"] | undefined | null | Variable<any, string>,
	received_reviews?: ValueTypes["ReviewsListRelationFilter"] | undefined | null | Variable<any, string>,
	sent_reviews?: ValueTypes["ReviewsListRelationFilter"] | undefined | null | Variable<any, string>,
	tenant_form_submissions?: ValueTypes["Tenant_form_submissionsListRelationFilter"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["Enumprofile_typeFilter"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["UsersRelationFilter"] | undefined | null | Variable<any, string>,
	user_id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>
};
	["profilesWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>,
	user_id_type?: ValueTypes["profilesUser_idTypeCompoundUniqueInput"] | undefined | null | Variable<any, string>
};
	["review_category"]:review_category;
	["reviews"]: AliasType<{
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile?:ValueTypes["profiles"],
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile?:ValueTypes["profiles"],
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["reviewsCreateManyReceived_by_profileInput"]: {
	category: ValueTypes["review_category"] | Variable<any, string>,
	comment?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	sent_by_profile_id: string | Variable<any, string>,
	stars?: number | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["reviewsCreateManyReceived_by_profileInputEnvelope"]: {
	data: Array<ValueTypes["reviewsCreateManyReceived_by_profileInput"]> | Variable<any, string>,
	skipDuplicates?: boolean | undefined | null | Variable<any, string>
};
	["reviewsCreateManySent_by_profileInput"]: {
	category: ValueTypes["review_category"] | Variable<any, string>,
	comment?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	received_by_profile_id: string | Variable<any, string>,
	stars?: number | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["reviewsCreateManySent_by_profileInputEnvelope"]: {
	data: Array<ValueTypes["reviewsCreateManySent_by_profileInput"]> | Variable<any, string>,
	skipDuplicates?: boolean | undefined | null | Variable<any, string>
};
	["reviewsCreateNestedManyWithoutReceived_by_profileInput"]: {
	connect?: Array<ValueTypes["reviewsWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	connectOrCreate?: Array<ValueTypes["reviewsCreateOrConnectWithoutReceived_by_profileInput"]> | undefined | null | Variable<any, string>,
	create?: Array<ValueTypes["reviewsCreateWithoutReceived_by_profileInput"]> | undefined | null | Variable<any, string>,
	createMany?: ValueTypes["reviewsCreateManyReceived_by_profileInputEnvelope"] | undefined | null | Variable<any, string>
};
	["reviewsCreateNestedManyWithoutSent_by_profileInput"]: {
	connect?: Array<ValueTypes["reviewsWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	connectOrCreate?: Array<ValueTypes["reviewsCreateOrConnectWithoutSent_by_profileInput"]> | undefined | null | Variable<any, string>,
	create?: Array<ValueTypes["reviewsCreateWithoutSent_by_profileInput"]> | undefined | null | Variable<any, string>,
	createMany?: ValueTypes["reviewsCreateManySent_by_profileInputEnvelope"] | undefined | null | Variable<any, string>
};
	["reviewsCreateOrConnectWithoutReceived_by_profileInput"]: {
	create: ValueTypes["reviewsCreateWithoutReceived_by_profileInput"] | Variable<any, string>,
	where: ValueTypes["reviewsWhereUniqueInput"] | Variable<any, string>
};
	["reviewsCreateOrConnectWithoutSent_by_profileInput"]: {
	create: ValueTypes["reviewsCreateWithoutSent_by_profileInput"] | Variable<any, string>,
	where: ValueTypes["reviewsWhereUniqueInput"] | Variable<any, string>
};
	["reviewsCreateWithoutReceived_by_profileInput"]: {
	category: ValueTypes["review_category"] | Variable<any, string>,
	comment?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	sent_by_profile: ValueTypes["profilesCreateNestedOneWithoutSent_reviewsInput"] | Variable<any, string>,
	stars?: number | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["reviewsCreateWithoutSent_by_profileInput"]: {
	category: ValueTypes["review_category"] | Variable<any, string>,
	comment?: string | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	received_by_profile: ValueTypes["profilesCreateNestedOneWithoutReceived_reviewsInput"] | Variable<any, string>,
	stars?: number | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["reviewsOrderByRelationAggregateInput"]: {
	_count?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>
};
	["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"]: {
	category: ValueTypes["review_category"] | Variable<any, string>,
	received_by_profile_id: string | Variable<any, string>,
	sent_by_profile_id: string | Variable<any, string>
};
	["reviewsWhereInput"]: {
	AND?: Array<ValueTypes["reviewsWhereInput"]> | undefined | null | Variable<any, string>,
	NOT?: Array<ValueTypes["reviewsWhereInput"]> | undefined | null | Variable<any, string>,
	OR?: Array<ValueTypes["reviewsWhereInput"]> | undefined | null | Variable<any, string>,
	category?: ValueTypes["Enumreview_categoryFilter"] | undefined | null | Variable<any, string>,
	comment?: ValueTypes["StringNullableFilter"] | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	received_by_profile?: ValueTypes["ProfilesRelationFilter"] | undefined | null | Variable<any, string>,
	received_by_profile_id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	sent_by_profile?: ValueTypes["ProfilesRelationFilter"] | undefined | null | Variable<any, string>,
	sent_by_profile_id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	stars?: ValueTypes["IntNullableFilter"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>
};
	["reviewsWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>,
	sent_by_profile_id_received_by_profile_id_category?: ValueTypes["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"] | undefined | null | Variable<any, string>
};
	["reviews_scaler_type"]: AliasType<{
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["tenant_form_submissions"]: AliasType<{
	created_at?:boolean | `@${string}`,
	duration_in_months?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	from_profile_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	profiles?:ValueTypes["profiles"],
	surname?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["tenant_form_submissionsCreateManyProfilesInput"]: {
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	duration_in_months: number | Variable<any, string>,
	email: string | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	phone: string | Variable<any, string>,
	surname: string | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["tenant_form_submissionsCreateManyProfilesInputEnvelope"]: {
	data: Array<ValueTypes["tenant_form_submissionsCreateManyProfilesInput"]> | Variable<any, string>,
	skipDuplicates?: boolean | undefined | null | Variable<any, string>
};
	["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"]: {
	connect?: Array<ValueTypes["tenant_form_submissionsWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	connectOrCreate?: Array<ValueTypes["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"]> | undefined | null | Variable<any, string>,
	create?: Array<ValueTypes["tenant_form_submissionsCreateWithoutProfilesInput"]> | undefined | null | Variable<any, string>,
	createMany?: ValueTypes["tenant_form_submissionsCreateManyProfilesInputEnvelope"] | undefined | null | Variable<any, string>
};
	["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"]: {
	create: ValueTypes["tenant_form_submissionsCreateWithoutProfilesInput"] | Variable<any, string>,
	where: ValueTypes["tenant_form_submissionsWhereUniqueInput"] | Variable<any, string>
};
	["tenant_form_submissionsCreateWithoutProfilesInput"]: {
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	duration_in_months: number | Variable<any, string>,
	email: string | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	phone: string | Variable<any, string>,
	surname: string | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["tenant_form_submissionsOrderByRelationAggregateInput"]: {
	_count?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>
};
	["tenant_form_submissionsWhereInput"]: {
	AND?: Array<ValueTypes["tenant_form_submissionsWhereInput"]> | undefined | null | Variable<any, string>,
	NOT?: Array<ValueTypes["tenant_form_submissionsWhereInput"]> | undefined | null | Variable<any, string>,
	OR?: Array<ValueTypes["tenant_form_submissionsWhereInput"]> | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>,
	duration_in_months?: ValueTypes["IntFilter"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	from_profile_id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	profiles?: ValueTypes["ProfilesRelationFilter"] | undefined | null | Variable<any, string>,
	surname?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>
};
	["tenant_form_submissionsWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>
};
	["users"]: AliasType<{
	_count?:ValueTypes["UsersCount"],
	created_at?:boolean | `@${string}`,
	date_of_birth?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	email_verified_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	password?:boolean | `@${string}`,
	permissions?:boolean | `@${string}`,
	profiles?:ValueTypes["profiles"],
	updated_at?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["usersCreateInput"]: {
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	date_of_birth: number | Variable<any, string>,
	email: string | Variable<any, string>,
	email_verified_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	password: string | Variable<any, string>,
	permissions?: ValueTypes["usersCreatepermissionsInput"] | undefined | null | Variable<any, string>,
	profiles?: ValueTypes["profilesCreateNestedManyWithoutUserInput"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	username: string | Variable<any, string>
};
	["usersCreateNestedOneWithoutProfilesInput"]: {
	connect?: ValueTypes["usersWhereUniqueInput"] | undefined | null | Variable<any, string>,
	connectOrCreate?: ValueTypes["usersCreateOrConnectWithoutProfilesInput"] | undefined | null | Variable<any, string>,
	create?: ValueTypes["usersCreateWithoutProfilesInput"] | undefined | null | Variable<any, string>
};
	["usersCreateOrConnectWithoutProfilesInput"]: {
	create: ValueTypes["usersCreateWithoutProfilesInput"] | Variable<any, string>,
	where: ValueTypes["usersWhereUniqueInput"] | Variable<any, string>
};
	["usersCreateWithoutProfilesInput"]: {
	created_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	date_of_birth: number | Variable<any, string>,
	email: string | Variable<any, string>,
	email_verified_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	password: string | Variable<any, string>,
	permissions?: ValueTypes["usersCreatepermissionsInput"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	username: string | Variable<any, string>
};
	["usersCreatepermissionsInput"]: {
	set: Array<ValueTypes["permission"]> | Variable<any, string>
};
	["usersOrderByWithRelationInput"]: {
	created_at?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	date_of_birth?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	email_verified_at?: ValueTypes["SortOrderInput"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	password?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	permissions?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	profiles?: ValueTypes["profilesOrderByRelationAggregateInput"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>,
	username?: ValueTypes["SortOrder"] | undefined | null | Variable<any, string>
};
	["usersWhereInput"]: {
	AND?: Array<ValueTypes["usersWhereInput"]> | undefined | null | Variable<any, string>,
	NOT?: Array<ValueTypes["usersWhereInput"]> | undefined | null | Variable<any, string>,
	OR?: Array<ValueTypes["usersWhereInput"]> | undefined | null | Variable<any, string>,
	created_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>,
	date_of_birth?: ValueTypes["IntFilter"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	email_verified_at?: ValueTypes["DateTimeNullableFilter"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	password?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>,
	permissions?: ValueTypes["EnumpermissionNullableListFilter"] | undefined | null | Variable<any, string>,
	profiles?: ValueTypes["ProfilesListRelationFilter"] | undefined | null | Variable<any, string>,
	updated_at?: ValueTypes["DateTimeFilter"] | undefined | null | Variable<any, string>,
	username?: ValueTypes["StringFilter"] | undefined | null | Variable<any, string>
};
	["usersWhereUniqueInput"]: {
	email?: string | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	username?: string | undefined | null | Variable<any, string>
}
  }

export type ResolverInputTypes = {
    ["CreateProfileInput"]: {
	bio?: string | undefined | null,
	description?: string | undefined | null,
	name: string,
	property_city?: string | undefined | null,
	property_house_number?: string | undefined | null,
	property_postcode?: string | undefined | null,
	property_state?: string | undefined | null,
	property_street_address?: string | undefined | null,
	type: ResolverInputTypes["profile_type"]
};
	["CreateReviewDto"]: {
	category: ResolverInputTypes["review_category"],
	comment?: string | undefined | null,
	profile_id: string,
	stars?: number | undefined | null
};
	["CreateTenantFormDto"]: {
	duration_in_months: number,
	email: string,
	name: string,
	phone: string,
	surname: string
};
	["CurrentUserResponseDto"]: AliasType<{
	email?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	permissions?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
["DateTime"]:unknown;
	["DateTimeFilter"]: {
	equals?: ResolverInputTypes["DateTime"] | undefined | null,
	gt?: ResolverInputTypes["DateTime"] | undefined | null,
	gte?: ResolverInputTypes["DateTime"] | undefined | null,
	in?: Array<ResolverInputTypes["DateTime"]> | undefined | null,
	lt?: ResolverInputTypes["DateTime"] | undefined | null,
	lte?: ResolverInputTypes["DateTime"] | undefined | null,
	not?: ResolverInputTypes["NestedDateTimeFilter"] | undefined | null,
	notIn?: Array<ResolverInputTypes["DateTime"]> | undefined | null
};
	["DateTimeNullableFilter"]: {
	equals?: ResolverInputTypes["DateTime"] | undefined | null,
	gt?: ResolverInputTypes["DateTime"] | undefined | null,
	gte?: ResolverInputTypes["DateTime"] | undefined | null,
	in?: Array<ResolverInputTypes["DateTime"]> | undefined | null,
	lt?: ResolverInputTypes["DateTime"] | undefined | null,
	lte?: ResolverInputTypes["DateTime"] | undefined | null,
	not?: ResolverInputTypes["NestedDateTimeNullableFilter"] | undefined | null,
	notIn?: Array<ResolverInputTypes["DateTime"]> | undefined | null
};
	["EnumpermissionNullableListFilter"]: {
	equals?: Array<ResolverInputTypes["permission"]> | undefined | null,
	has?: ResolverInputTypes["permission"] | undefined | null,
	hasEvery?: Array<ResolverInputTypes["permission"]> | undefined | null,
	hasSome?: Array<ResolverInputTypes["permission"]> | undefined | null,
	isEmpty?: boolean | undefined | null
};
	["Enumprofile_typeFilter"]: {
	equals?: ResolverInputTypes["profile_type"] | undefined | null,
	in?: Array<ResolverInputTypes["profile_type"]> | undefined | null,
	not?: ResolverInputTypes["NestedEnumprofile_typeFilter"] | undefined | null,
	notIn?: Array<ResolverInputTypes["profile_type"]> | undefined | null
};
	["Enumreview_categoryFilter"]: {
	equals?: ResolverInputTypes["review_category"] | undefined | null,
	in?: Array<ResolverInputTypes["review_category"]> | undefined | null,
	not?: ResolverInputTypes["NestedEnumreview_categoryFilter"] | undefined | null,
	notIn?: Array<ResolverInputTypes["review_category"]> | undefined | null
};
	["IntFilter"]: {
	equals?: number | undefined | null,
	gt?: number | undefined | null,
	gte?: number | undefined | null,
	in?: Array<number> | undefined | null,
	lt?: number | undefined | null,
	lte?: number | undefined | null,
	not?: ResolverInputTypes["NestedIntFilter"] | undefined | null,
	notIn?: Array<number> | undefined | null
};
	["IntNullableFilter"]: {
	equals?: number | undefined | null,
	gt?: number | undefined | null,
	gte?: number | undefined | null,
	in?: Array<number> | undefined | null,
	lt?: number | undefined | null,
	lte?: number | undefined | null,
	not?: ResolverInputTypes["NestedIntNullableFilter"] | undefined | null,
	notIn?: Array<number> | undefined | null
};
	["LoginDto"]: {
	password: string,
	usernameOrEmail: string
};
	["LoginResponseDto"]: AliasType<{
	accessToken?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Mutation"]: AliasType<{
createProfile?: [{	data: ResolverInputTypes["CreateProfileInput"]},boolean | `@${string}`],
createReview?: [{	data: ResolverInputTypes["CreateReviewDto"]},boolean | `@${string}`],
createTenantFormSubmission?: [{	data: ResolverInputTypes["CreateTenantFormDto"]},boolean | `@${string}`],
createUser?: [{	data: ResolverInputTypes["usersCreateInput"]},ResolverInputTypes["users"]],
	logout?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
signUp?: [{	data: ResolverInputTypes["SignUpDto"]},boolean | `@${string}`],
		__typename?: boolean | `@${string}`
}>;
	["NestedDateTimeFilter"]: {
	equals?: ResolverInputTypes["DateTime"] | undefined | null,
	gt?: ResolverInputTypes["DateTime"] | undefined | null,
	gte?: ResolverInputTypes["DateTime"] | undefined | null,
	in?: Array<ResolverInputTypes["DateTime"]> | undefined | null,
	lt?: ResolverInputTypes["DateTime"] | undefined | null,
	lte?: ResolverInputTypes["DateTime"] | undefined | null,
	not?: ResolverInputTypes["NestedDateTimeFilter"] | undefined | null,
	notIn?: Array<ResolverInputTypes["DateTime"]> | undefined | null
};
	["NestedDateTimeNullableFilter"]: {
	equals?: ResolverInputTypes["DateTime"] | undefined | null,
	gt?: ResolverInputTypes["DateTime"] | undefined | null,
	gte?: ResolverInputTypes["DateTime"] | undefined | null,
	in?: Array<ResolverInputTypes["DateTime"]> | undefined | null,
	lt?: ResolverInputTypes["DateTime"] | undefined | null,
	lte?: ResolverInputTypes["DateTime"] | undefined | null,
	not?: ResolverInputTypes["NestedDateTimeNullableFilter"] | undefined | null,
	notIn?: Array<ResolverInputTypes["DateTime"]> | undefined | null
};
	["NestedEnumprofile_typeFilter"]: {
	equals?: ResolverInputTypes["profile_type"] | undefined | null,
	in?: Array<ResolverInputTypes["profile_type"]> | undefined | null,
	not?: ResolverInputTypes["NestedEnumprofile_typeFilter"] | undefined | null,
	notIn?: Array<ResolverInputTypes["profile_type"]> | undefined | null
};
	["NestedEnumreview_categoryFilter"]: {
	equals?: ResolverInputTypes["review_category"] | undefined | null,
	in?: Array<ResolverInputTypes["review_category"]> | undefined | null,
	not?: ResolverInputTypes["NestedEnumreview_categoryFilter"] | undefined | null,
	notIn?: Array<ResolverInputTypes["review_category"]> | undefined | null
};
	["NestedIntFilter"]: {
	equals?: number | undefined | null,
	gt?: number | undefined | null,
	gte?: number | undefined | null,
	in?: Array<number> | undefined | null,
	lt?: number | undefined | null,
	lte?: number | undefined | null,
	not?: ResolverInputTypes["NestedIntFilter"] | undefined | null,
	notIn?: Array<number> | undefined | null
};
	["NestedIntNullableFilter"]: {
	equals?: number | undefined | null,
	gt?: number | undefined | null,
	gte?: number | undefined | null,
	in?: Array<number> | undefined | null,
	lt?: number | undefined | null,
	lte?: number | undefined | null,
	not?: ResolverInputTypes["NestedIntNullableFilter"] | undefined | null,
	notIn?: Array<number> | undefined | null
};
	["NestedStringFilter"]: {
	contains?: string | undefined | null,
	endsWith?: string | undefined | null,
	equals?: string | undefined | null,
	gt?: string | undefined | null,
	gte?: string | undefined | null,
	in?: Array<string> | undefined | null,
	lt?: string | undefined | null,
	lte?: string | undefined | null,
	not?: ResolverInputTypes["NestedStringFilter"] | undefined | null,
	notIn?: Array<string> | undefined | null,
	startsWith?: string | undefined | null
};
	["NestedStringNullableFilter"]: {
	contains?: string | undefined | null,
	endsWith?: string | undefined | null,
	equals?: string | undefined | null,
	gt?: string | undefined | null,
	gte?: string | undefined | null,
	in?: Array<string> | undefined | null,
	lt?: string | undefined | null,
	lte?: string | undefined | null,
	not?: ResolverInputTypes["NestedStringNullableFilter"] | undefined | null,
	notIn?: Array<string> | undefined | null,
	startsWith?: string | undefined | null
};
	["NullsOrder"]:NullsOrder;
	["PostsCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	media?:boolean | `@${string}`,
	profile_id?:boolean | `@${string}`,
	title?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PostsListRelationFilter"]: {
	every?: ResolverInputTypes["postsWhereInput"] | undefined | null,
	none?: ResolverInputTypes["postsWhereInput"] | undefined | null,
	some?: ResolverInputTypes["postsWhereInput"] | undefined | null
};
	["PostsMaxAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	profile_id?:boolean | `@${string}`,
	title?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["PostsMinAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	profile_id?:boolean | `@${string}`,
	title?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesCount"]: AliasType<{
	posts?:boolean | `@${string}`,
	received_reviews?:boolean | `@${string}`,
	sent_reviews?:boolean | `@${string}`,
	tenant_form_submissions?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	bio?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	property_city?:boolean | `@${string}`,
	property_house_number?:boolean | `@${string}`,
	property_postcode?:boolean | `@${string}`,
	property_state?:boolean | `@${string}`,
	property_street_address?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	user_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesListRelationFilter"]: {
	every?: ResolverInputTypes["profilesWhereInput"] | undefined | null,
	none?: ResolverInputTypes["profilesWhereInput"] | undefined | null,
	some?: ResolverInputTypes["profilesWhereInput"] | undefined | null
};
	["ProfilesMaxAggregate"]: AliasType<{
	bio?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	property_city?:boolean | `@${string}`,
	property_house_number?:boolean | `@${string}`,
	property_postcode?:boolean | `@${string}`,
	property_state?:boolean | `@${string}`,
	property_street_address?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	user_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesMinAggregate"]: AliasType<{
	bio?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	property_city?:boolean | `@${string}`,
	property_house_number?:boolean | `@${string}`,
	property_postcode?:boolean | `@${string}`,
	property_state?:boolean | `@${string}`,
	property_street_address?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	user_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ProfilesRelationFilter"]: {
	is?: ResolverInputTypes["profilesWhereInput"] | undefined | null,
	isNot?: ResolverInputTypes["profilesWhereInput"] | undefined | null
};
	["ProfilesScalarFieldEnum"]:ProfilesScalarFieldEnum;
	["Query"]: AliasType<{
	currentUser?:ResolverInputTypes["CurrentUserResponseDto"],
getAllReviewsByProfileId?: [{	profile_id: string},ResolverInputTypes["ReviewByProfileResponseDto"]],
getAllUsers?: [{	cursor?: ResolverInputTypes["usersWhereUniqueInput"] | undefined | null,	distinct?: Array<ResolverInputTypes["UsersScalarFieldEnum"]> | undefined | null,	orderBy?: Array<ResolverInputTypes["usersOrderByWithRelationInput"]> | undefined | null,	skip?: number | undefined | null,	take?: number | undefined | null,	where?: ResolverInputTypes["usersWhereInput"] | undefined | null},ResolverInputTypes["users"]],
getProfile?: [{	cursor?: ResolverInputTypes["profilesWhereUniqueInput"] | undefined | null,	distinct?: Array<ResolverInputTypes["ProfilesScalarFieldEnum"]> | undefined | null,	orderBy?: Array<ResolverInputTypes["profilesOrderByWithRelationInput"]> | undefined | null,	skip?: number | undefined | null,	take?: number | undefined | null,	where?: ResolverInputTypes["profilesWhereInput"] | undefined | null},ResolverInputTypes["profiles"]],
getProfiles?: [{	cursor?: ResolverInputTypes["profilesWhereUniqueInput"] | undefined | null,	distinct?: Array<ResolverInputTypes["ProfilesScalarFieldEnum"]> | undefined | null,	orderBy?: Array<ResolverInputTypes["profilesOrderByWithRelationInput"]> | undefined | null,	skip?: number | undefined | null,	take?: number | undefined | null,	where?: ResolverInputTypes["profilesWhereInput"] | undefined | null},ResolverInputTypes["profiles"]],
	getReviewCategories?:boolean | `@${string}`,
getReviewsOnProfileByLoggedInUser?: [{	profile_id: string},ResolverInputTypes["reviews"]],
login?: [{	data: ResolverInputTypes["LoginDto"]},ResolverInputTypes["LoginResponseDto"]],
		__typename?: boolean | `@${string}`
}>;
	["QueryMode"]:QueryMode;
	["ReviewByProfileResponseDto"]: AliasType<{
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	sent_reviews?:ResolverInputTypes["reviews_scaler_type"],
		__typename?: boolean | `@${string}`
}>;
	["ReviewsAvgAggregate"]: AliasType<{
	stars?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReviewsCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReviewsListRelationFilter"]: {
	every?: ResolverInputTypes["reviewsWhereInput"] | undefined | null,
	none?: ResolverInputTypes["reviewsWhereInput"] | undefined | null,
	some?: ResolverInputTypes["reviewsWhereInput"] | undefined | null
};
	["ReviewsMaxAggregate"]: AliasType<{
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReviewsMinAggregate"]: AliasType<{
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReviewsSumAggregate"]: AliasType<{
	stars?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["SignUpDto"]: {
	confirmPassword: string,
	dateOfBirth: number,
	email: string,
	password: string,
	username: string
};
	["SortOrder"]:SortOrder;
	["SortOrderInput"]: {
	nulls?: ResolverInputTypes["NullsOrder"] | undefined | null,
	sort: ResolverInputTypes["SortOrder"]
};
	["StringFilter"]: {
	contains?: string | undefined | null,
	endsWith?: string | undefined | null,
	equals?: string | undefined | null,
	gt?: string | undefined | null,
	gte?: string | undefined | null,
	in?: Array<string> | undefined | null,
	lt?: string | undefined | null,
	lte?: string | undefined | null,
	mode?: ResolverInputTypes["QueryMode"] | undefined | null,
	not?: ResolverInputTypes["NestedStringFilter"] | undefined | null,
	notIn?: Array<string> | undefined | null,
	startsWith?: string | undefined | null
};
	["StringNullableFilter"]: {
	contains?: string | undefined | null,
	endsWith?: string | undefined | null,
	equals?: string | undefined | null,
	gt?: string | undefined | null,
	gte?: string | undefined | null,
	in?: Array<string> | undefined | null,
	lt?: string | undefined | null,
	lte?: string | undefined | null,
	mode?: ResolverInputTypes["QueryMode"] | undefined | null,
	not?: ResolverInputTypes["NestedStringNullableFilter"] | undefined | null,
	notIn?: Array<string> | undefined | null,
	startsWith?: string | undefined | null
};
	["StringNullableListFilter"]: {
	equals?: Array<string> | undefined | null,
	has?: string | undefined | null,
	hasEvery?: Array<string> | undefined | null,
	hasSome?: Array<string> | undefined | null,
	isEmpty?: boolean | undefined | null
};
	["Tenant_form_submissionsAvgAggregate"]: AliasType<{
	duration_in_months?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tenant_form_submissionsCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	duration_in_months?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	from_profile_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	surname?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tenant_form_submissionsListRelationFilter"]: {
	every?: ResolverInputTypes["tenant_form_submissionsWhereInput"] | undefined | null,
	none?: ResolverInputTypes["tenant_form_submissionsWhereInput"] | undefined | null,
	some?: ResolverInputTypes["tenant_form_submissionsWhereInput"] | undefined | null
};
	["Tenant_form_submissionsMaxAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	duration_in_months?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	from_profile_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	surname?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tenant_form_submissionsMinAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	duration_in_months?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	from_profile_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	surname?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Tenant_form_submissionsSumAggregate"]: AliasType<{
	duration_in_months?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersAvgAggregate"]: AliasType<{
	date_of_birth?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersCount"]: AliasType<{
	profiles?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersCountAggregate"]: AliasType<{
	_all?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	date_of_birth?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	email_verified_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	password?:boolean | `@${string}`,
	permissions?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersMaxAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	date_of_birth?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	email_verified_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	password?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersMinAggregate"]: AliasType<{
	created_at?:boolean | `@${string}`,
	date_of_birth?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	email_verified_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	password?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UsersRelationFilter"]: {
	is?: ResolverInputTypes["usersWhereInput"] | undefined | null,
	isNot?: ResolverInputTypes["usersWhereInput"] | undefined | null
};
	["UsersScalarFieldEnum"]:UsersScalarFieldEnum;
	["UsersSumAggregate"]: AliasType<{
	date_of_birth?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["permission"]:permission;
	["posts"]: AliasType<{
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	media?:boolean | `@${string}`,
	profile_id?:boolean | `@${string}`,
	profiles?:ResolverInputTypes["profiles"],
	title?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["postsCreateManyProfilesInput"]: {
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	description: string,
	id?: string | undefined | null,
	media?: ResolverInputTypes["postsCreatemediaInput"] | undefined | null,
	title: string,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["postsCreateManyProfilesInputEnvelope"]: {
	data: Array<ResolverInputTypes["postsCreateManyProfilesInput"]>,
	skipDuplicates?: boolean | undefined | null
};
	["postsCreateNestedManyWithoutProfilesInput"]: {
	connect?: Array<ResolverInputTypes["postsWhereUniqueInput"]> | undefined | null,
	connectOrCreate?: Array<ResolverInputTypes["postsCreateOrConnectWithoutProfilesInput"]> | undefined | null,
	create?: Array<ResolverInputTypes["postsCreateWithoutProfilesInput"]> | undefined | null,
	createMany?: ResolverInputTypes["postsCreateManyProfilesInputEnvelope"] | undefined | null
};
	["postsCreateOrConnectWithoutProfilesInput"]: {
	create: ResolverInputTypes["postsCreateWithoutProfilesInput"],
	where: ResolverInputTypes["postsWhereUniqueInput"]
};
	["postsCreateWithoutProfilesInput"]: {
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	description: string,
	id?: string | undefined | null,
	media?: ResolverInputTypes["postsCreatemediaInput"] | undefined | null,
	title: string,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["postsCreatemediaInput"]: {
	set: Array<string>
};
	["postsOrderByRelationAggregateInput"]: {
	_count?: ResolverInputTypes["SortOrder"] | undefined | null
};
	["postsWhereInput"]: {
	AND?: Array<ResolverInputTypes["postsWhereInput"]> | undefined | null,
	NOT?: Array<ResolverInputTypes["postsWhereInput"]> | undefined | null,
	OR?: Array<ResolverInputTypes["postsWhereInput"]> | undefined | null,
	created_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null,
	description?: ResolverInputTypes["StringFilter"] | undefined | null,
	id?: ResolverInputTypes["StringFilter"] | undefined | null,
	media?: ResolverInputTypes["StringNullableListFilter"] | undefined | null,
	profile_id?: ResolverInputTypes["StringFilter"] | undefined | null,
	profiles?: ResolverInputTypes["ProfilesRelationFilter"] | undefined | null,
	title?: ResolverInputTypes["StringFilter"] | undefined | null,
	updated_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null
};
	["postsWhereUniqueInput"]: {
	id?: string | undefined | null
};
	["profile_type"]:profile_type;
	["profiles"]: AliasType<{
	_count?:ResolverInputTypes["ProfilesCount"],
	bio?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	posts?:ResolverInputTypes["posts"],
	property_city?:boolean | `@${string}`,
	property_house_number?:boolean | `@${string}`,
	property_postcode?:boolean | `@${string}`,
	property_state?:boolean | `@${string}`,
	property_street_address?:boolean | `@${string}`,
	received_reviews?:ResolverInputTypes["reviews"],
	sent_reviews?:ResolverInputTypes["reviews"],
	tenant_form_submissions?:ResolverInputTypes["tenant_form_submissions"],
	type?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
	user?:ResolverInputTypes["users"],
	user_id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["profilesCreateManyUserInput"]: {
	bio?: string | undefined | null,
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	description?: string | undefined | null,
	id?: string | undefined | null,
	name: string,
	property_city?: string | undefined | null,
	property_house_number?: string | undefined | null,
	property_postcode?: string | undefined | null,
	property_state?: string | undefined | null,
	property_street_address?: string | undefined | null,
	type: ResolverInputTypes["profile_type"],
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["profilesCreateManyUserInputEnvelope"]: {
	data: Array<ResolverInputTypes["profilesCreateManyUserInput"]>,
	skipDuplicates?: boolean | undefined | null
};
	["profilesCreateNestedManyWithoutUserInput"]: {
	connect?: Array<ResolverInputTypes["profilesWhereUniqueInput"]> | undefined | null,
	connectOrCreate?: Array<ResolverInputTypes["profilesCreateOrConnectWithoutUserInput"]> | undefined | null,
	create?: Array<ResolverInputTypes["profilesCreateWithoutUserInput"]> | undefined | null,
	createMany?: ResolverInputTypes["profilesCreateManyUserInputEnvelope"] | undefined | null
};
	["profilesCreateNestedOneWithoutReceived_reviewsInput"]: {
	connect?: ResolverInputTypes["profilesWhereUniqueInput"] | undefined | null,
	connectOrCreate?: ResolverInputTypes["profilesCreateOrConnectWithoutReceived_reviewsInput"] | undefined | null,
	create?: ResolverInputTypes["profilesCreateWithoutReceived_reviewsInput"] | undefined | null
};
	["profilesCreateNestedOneWithoutSent_reviewsInput"]: {
	connect?: ResolverInputTypes["profilesWhereUniqueInput"] | undefined | null,
	connectOrCreate?: ResolverInputTypes["profilesCreateOrConnectWithoutSent_reviewsInput"] | undefined | null,
	create?: ResolverInputTypes["profilesCreateWithoutSent_reviewsInput"] | undefined | null
};
	["profilesCreateOrConnectWithoutReceived_reviewsInput"]: {
	create: ResolverInputTypes["profilesCreateWithoutReceived_reviewsInput"],
	where: ResolverInputTypes["profilesWhereUniqueInput"]
};
	["profilesCreateOrConnectWithoutSent_reviewsInput"]: {
	create: ResolverInputTypes["profilesCreateWithoutSent_reviewsInput"],
	where: ResolverInputTypes["profilesWhereUniqueInput"]
};
	["profilesCreateOrConnectWithoutUserInput"]: {
	create: ResolverInputTypes["profilesCreateWithoutUserInput"],
	where: ResolverInputTypes["profilesWhereUniqueInput"]
};
	["profilesCreateWithoutReceived_reviewsInput"]: {
	bio?: string | undefined | null,
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	description?: string | undefined | null,
	id?: string | undefined | null,
	name: string,
	posts?: ResolverInputTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined | null,
	property_city?: string | undefined | null,
	property_house_number?: string | undefined | null,
	property_postcode?: string | undefined | null,
	property_state?: string | undefined | null,
	property_street_address?: string | undefined | null,
	sent_reviews?: ResolverInputTypes["reviewsCreateNestedManyWithoutSent_by_profileInput"] | undefined | null,
	tenant_form_submissions?: ResolverInputTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined | null,
	type: ResolverInputTypes["profile_type"],
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null,
	user: ResolverInputTypes["usersCreateNestedOneWithoutProfilesInput"]
};
	["profilesCreateWithoutSent_reviewsInput"]: {
	bio?: string | undefined | null,
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	description?: string | undefined | null,
	id?: string | undefined | null,
	name: string,
	posts?: ResolverInputTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined | null,
	property_city?: string | undefined | null,
	property_house_number?: string | undefined | null,
	property_postcode?: string | undefined | null,
	property_state?: string | undefined | null,
	property_street_address?: string | undefined | null,
	received_reviews?: ResolverInputTypes["reviewsCreateNestedManyWithoutReceived_by_profileInput"] | undefined | null,
	tenant_form_submissions?: ResolverInputTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined | null,
	type: ResolverInputTypes["profile_type"],
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null,
	user: ResolverInputTypes["usersCreateNestedOneWithoutProfilesInput"]
};
	["profilesCreateWithoutUserInput"]: {
	bio?: string | undefined | null,
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	description?: string | undefined | null,
	id?: string | undefined | null,
	name: string,
	posts?: ResolverInputTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined | null,
	property_city?: string | undefined | null,
	property_house_number?: string | undefined | null,
	property_postcode?: string | undefined | null,
	property_state?: string | undefined | null,
	property_street_address?: string | undefined | null,
	received_reviews?: ResolverInputTypes["reviewsCreateNestedManyWithoutReceived_by_profileInput"] | undefined | null,
	sent_reviews?: ResolverInputTypes["reviewsCreateNestedManyWithoutSent_by_profileInput"] | undefined | null,
	tenant_form_submissions?: ResolverInputTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined | null,
	type: ResolverInputTypes["profile_type"],
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["profilesOrderByRelationAggregateInput"]: {
	_count?: ResolverInputTypes["SortOrder"] | undefined | null
};
	["profilesOrderByWithRelationInput"]: {
	bio?: ResolverInputTypes["SortOrderInput"] | undefined | null,
	created_at?: ResolverInputTypes["SortOrder"] | undefined | null,
	description?: ResolverInputTypes["SortOrderInput"] | undefined | null,
	id?: ResolverInputTypes["SortOrder"] | undefined | null,
	name?: ResolverInputTypes["SortOrder"] | undefined | null,
	posts?: ResolverInputTypes["postsOrderByRelationAggregateInput"] | undefined | null,
	property_city?: ResolverInputTypes["SortOrderInput"] | undefined | null,
	property_house_number?: ResolverInputTypes["SortOrderInput"] | undefined | null,
	property_postcode?: ResolverInputTypes["SortOrderInput"] | undefined | null,
	property_state?: ResolverInputTypes["SortOrderInput"] | undefined | null,
	property_street_address?: ResolverInputTypes["SortOrderInput"] | undefined | null,
	received_reviews?: ResolverInputTypes["reviewsOrderByRelationAggregateInput"] | undefined | null,
	sent_reviews?: ResolverInputTypes["reviewsOrderByRelationAggregateInput"] | undefined | null,
	tenant_form_submissions?: ResolverInputTypes["tenant_form_submissionsOrderByRelationAggregateInput"] | undefined | null,
	type?: ResolverInputTypes["SortOrder"] | undefined | null,
	updated_at?: ResolverInputTypes["SortOrder"] | undefined | null,
	user?: ResolverInputTypes["usersOrderByWithRelationInput"] | undefined | null,
	user_id?: ResolverInputTypes["SortOrder"] | undefined | null
};
	["profilesUser_idTypeCompoundUniqueInput"]: {
	type: ResolverInputTypes["profile_type"],
	user_id: string
};
	["profilesWhereInput"]: {
	AND?: Array<ResolverInputTypes["profilesWhereInput"]> | undefined | null,
	NOT?: Array<ResolverInputTypes["profilesWhereInput"]> | undefined | null,
	OR?: Array<ResolverInputTypes["profilesWhereInput"]> | undefined | null,
	bio?: ResolverInputTypes["StringNullableFilter"] | undefined | null,
	created_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null,
	description?: ResolverInputTypes["StringNullableFilter"] | undefined | null,
	id?: ResolverInputTypes["StringFilter"] | undefined | null,
	name?: ResolverInputTypes["StringFilter"] | undefined | null,
	posts?: ResolverInputTypes["PostsListRelationFilter"] | undefined | null,
	property_city?: ResolverInputTypes["StringNullableFilter"] | undefined | null,
	property_house_number?: ResolverInputTypes["StringNullableFilter"] | undefined | null,
	property_postcode?: ResolverInputTypes["StringNullableFilter"] | undefined | null,
	property_state?: ResolverInputTypes["StringNullableFilter"] | undefined | null,
	property_street_address?: ResolverInputTypes["StringNullableFilter"] | undefined | null,
	received_reviews?: ResolverInputTypes["ReviewsListRelationFilter"] | undefined | null,
	sent_reviews?: ResolverInputTypes["ReviewsListRelationFilter"] | undefined | null,
	tenant_form_submissions?: ResolverInputTypes["Tenant_form_submissionsListRelationFilter"] | undefined | null,
	type?: ResolverInputTypes["Enumprofile_typeFilter"] | undefined | null,
	updated_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null,
	user?: ResolverInputTypes["UsersRelationFilter"] | undefined | null,
	user_id?: ResolverInputTypes["StringFilter"] | undefined | null
};
	["profilesWhereUniqueInput"]: {
	id?: string | undefined | null,
	user_id_type?: ResolverInputTypes["profilesUser_idTypeCompoundUniqueInput"] | undefined | null
};
	["review_category"]:review_category;
	["reviews"]: AliasType<{
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile?:ResolverInputTypes["profiles"],
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile?:ResolverInputTypes["profiles"],
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["reviewsCreateManyReceived_by_profileInput"]: {
	category: ResolverInputTypes["review_category"],
	comment?: string | undefined | null,
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	sent_by_profile_id: string,
	stars?: number | undefined | null,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["reviewsCreateManyReceived_by_profileInputEnvelope"]: {
	data: Array<ResolverInputTypes["reviewsCreateManyReceived_by_profileInput"]>,
	skipDuplicates?: boolean | undefined | null
};
	["reviewsCreateManySent_by_profileInput"]: {
	category: ResolverInputTypes["review_category"],
	comment?: string | undefined | null,
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	received_by_profile_id: string,
	stars?: number | undefined | null,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["reviewsCreateManySent_by_profileInputEnvelope"]: {
	data: Array<ResolverInputTypes["reviewsCreateManySent_by_profileInput"]>,
	skipDuplicates?: boolean | undefined | null
};
	["reviewsCreateNestedManyWithoutReceived_by_profileInput"]: {
	connect?: Array<ResolverInputTypes["reviewsWhereUniqueInput"]> | undefined | null,
	connectOrCreate?: Array<ResolverInputTypes["reviewsCreateOrConnectWithoutReceived_by_profileInput"]> | undefined | null,
	create?: Array<ResolverInputTypes["reviewsCreateWithoutReceived_by_profileInput"]> | undefined | null,
	createMany?: ResolverInputTypes["reviewsCreateManyReceived_by_profileInputEnvelope"] | undefined | null
};
	["reviewsCreateNestedManyWithoutSent_by_profileInput"]: {
	connect?: Array<ResolverInputTypes["reviewsWhereUniqueInput"]> | undefined | null,
	connectOrCreate?: Array<ResolverInputTypes["reviewsCreateOrConnectWithoutSent_by_profileInput"]> | undefined | null,
	create?: Array<ResolverInputTypes["reviewsCreateWithoutSent_by_profileInput"]> | undefined | null,
	createMany?: ResolverInputTypes["reviewsCreateManySent_by_profileInputEnvelope"] | undefined | null
};
	["reviewsCreateOrConnectWithoutReceived_by_profileInput"]: {
	create: ResolverInputTypes["reviewsCreateWithoutReceived_by_profileInput"],
	where: ResolverInputTypes["reviewsWhereUniqueInput"]
};
	["reviewsCreateOrConnectWithoutSent_by_profileInput"]: {
	create: ResolverInputTypes["reviewsCreateWithoutSent_by_profileInput"],
	where: ResolverInputTypes["reviewsWhereUniqueInput"]
};
	["reviewsCreateWithoutReceived_by_profileInput"]: {
	category: ResolverInputTypes["review_category"],
	comment?: string | undefined | null,
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	sent_by_profile: ResolverInputTypes["profilesCreateNestedOneWithoutSent_reviewsInput"],
	stars?: number | undefined | null,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["reviewsCreateWithoutSent_by_profileInput"]: {
	category: ResolverInputTypes["review_category"],
	comment?: string | undefined | null,
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	received_by_profile: ResolverInputTypes["profilesCreateNestedOneWithoutReceived_reviewsInput"],
	stars?: number | undefined | null,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["reviewsOrderByRelationAggregateInput"]: {
	_count?: ResolverInputTypes["SortOrder"] | undefined | null
};
	["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"]: {
	category: ResolverInputTypes["review_category"],
	received_by_profile_id: string,
	sent_by_profile_id: string
};
	["reviewsWhereInput"]: {
	AND?: Array<ResolverInputTypes["reviewsWhereInput"]> | undefined | null,
	NOT?: Array<ResolverInputTypes["reviewsWhereInput"]> | undefined | null,
	OR?: Array<ResolverInputTypes["reviewsWhereInput"]> | undefined | null,
	category?: ResolverInputTypes["Enumreview_categoryFilter"] | undefined | null,
	comment?: ResolverInputTypes["StringNullableFilter"] | undefined | null,
	created_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null,
	id?: ResolverInputTypes["StringFilter"] | undefined | null,
	received_by_profile?: ResolverInputTypes["ProfilesRelationFilter"] | undefined | null,
	received_by_profile_id?: ResolverInputTypes["StringFilter"] | undefined | null,
	sent_by_profile?: ResolverInputTypes["ProfilesRelationFilter"] | undefined | null,
	sent_by_profile_id?: ResolverInputTypes["StringFilter"] | undefined | null,
	stars?: ResolverInputTypes["IntNullableFilter"] | undefined | null,
	updated_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null
};
	["reviewsWhereUniqueInput"]: {
	id?: string | undefined | null,
	sent_by_profile_id_received_by_profile_id_category?: ResolverInputTypes["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"] | undefined | null
};
	["reviews_scaler_type"]: AliasType<{
	category?:boolean | `@${string}`,
	comment?:boolean | `@${string}`,
	created_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	received_by_profile_id?:boolean | `@${string}`,
	sent_by_profile_id?:boolean | `@${string}`,
	stars?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["tenant_form_submissions"]: AliasType<{
	created_at?:boolean | `@${string}`,
	duration_in_months?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	from_profile_id?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	profiles?:ResolverInputTypes["profiles"],
	surname?:boolean | `@${string}`,
	updated_at?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["tenant_form_submissionsCreateManyProfilesInput"]: {
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	duration_in_months: number,
	email: string,
	id?: string | undefined | null,
	name: string,
	phone: string,
	surname: string,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["tenant_form_submissionsCreateManyProfilesInputEnvelope"]: {
	data: Array<ResolverInputTypes["tenant_form_submissionsCreateManyProfilesInput"]>,
	skipDuplicates?: boolean | undefined | null
};
	["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"]: {
	connect?: Array<ResolverInputTypes["tenant_form_submissionsWhereUniqueInput"]> | undefined | null,
	connectOrCreate?: Array<ResolverInputTypes["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"]> | undefined | null,
	create?: Array<ResolverInputTypes["tenant_form_submissionsCreateWithoutProfilesInput"]> | undefined | null,
	createMany?: ResolverInputTypes["tenant_form_submissionsCreateManyProfilesInputEnvelope"] | undefined | null
};
	["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"]: {
	create: ResolverInputTypes["tenant_form_submissionsCreateWithoutProfilesInput"],
	where: ResolverInputTypes["tenant_form_submissionsWhereUniqueInput"]
};
	["tenant_form_submissionsCreateWithoutProfilesInput"]: {
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	duration_in_months: number,
	email: string,
	id?: string | undefined | null,
	name: string,
	phone: string,
	surname: string,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null
};
	["tenant_form_submissionsOrderByRelationAggregateInput"]: {
	_count?: ResolverInputTypes["SortOrder"] | undefined | null
};
	["tenant_form_submissionsWhereInput"]: {
	AND?: Array<ResolverInputTypes["tenant_form_submissionsWhereInput"]> | undefined | null,
	NOT?: Array<ResolverInputTypes["tenant_form_submissionsWhereInput"]> | undefined | null,
	OR?: Array<ResolverInputTypes["tenant_form_submissionsWhereInput"]> | undefined | null,
	created_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null,
	duration_in_months?: ResolverInputTypes["IntFilter"] | undefined | null,
	email?: ResolverInputTypes["StringFilter"] | undefined | null,
	from_profile_id?: ResolverInputTypes["StringFilter"] | undefined | null,
	id?: ResolverInputTypes["StringFilter"] | undefined | null,
	name?: ResolverInputTypes["StringFilter"] | undefined | null,
	phone?: ResolverInputTypes["StringFilter"] | undefined | null,
	profiles?: ResolverInputTypes["ProfilesRelationFilter"] | undefined | null,
	surname?: ResolverInputTypes["StringFilter"] | undefined | null,
	updated_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null
};
	["tenant_form_submissionsWhereUniqueInput"]: {
	id?: string | undefined | null
};
	["users"]: AliasType<{
	_count?:ResolverInputTypes["UsersCount"],
	created_at?:boolean | `@${string}`,
	date_of_birth?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	email_verified_at?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	password?:boolean | `@${string}`,
	permissions?:boolean | `@${string}`,
	profiles?:ResolverInputTypes["profiles"],
	updated_at?:boolean | `@${string}`,
	username?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["usersCreateInput"]: {
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	date_of_birth: number,
	email: string,
	email_verified_at?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	password: string,
	permissions?: ResolverInputTypes["usersCreatepermissionsInput"] | undefined | null,
	profiles?: ResolverInputTypes["profilesCreateNestedManyWithoutUserInput"] | undefined | null,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null,
	username: string
};
	["usersCreateNestedOneWithoutProfilesInput"]: {
	connect?: ResolverInputTypes["usersWhereUniqueInput"] | undefined | null,
	connectOrCreate?: ResolverInputTypes["usersCreateOrConnectWithoutProfilesInput"] | undefined | null,
	create?: ResolverInputTypes["usersCreateWithoutProfilesInput"] | undefined | null
};
	["usersCreateOrConnectWithoutProfilesInput"]: {
	create: ResolverInputTypes["usersCreateWithoutProfilesInput"],
	where: ResolverInputTypes["usersWhereUniqueInput"]
};
	["usersCreateWithoutProfilesInput"]: {
	created_at?: ResolverInputTypes["DateTime"] | undefined | null,
	date_of_birth: number,
	email: string,
	email_verified_at?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	password: string,
	permissions?: ResolverInputTypes["usersCreatepermissionsInput"] | undefined | null,
	updated_at?: ResolverInputTypes["DateTime"] | undefined | null,
	username: string
};
	["usersCreatepermissionsInput"]: {
	set: Array<ResolverInputTypes["permission"]>
};
	["usersOrderByWithRelationInput"]: {
	created_at?: ResolverInputTypes["SortOrder"] | undefined | null,
	date_of_birth?: ResolverInputTypes["SortOrder"] | undefined | null,
	email?: ResolverInputTypes["SortOrder"] | undefined | null,
	email_verified_at?: ResolverInputTypes["SortOrderInput"] | undefined | null,
	id?: ResolverInputTypes["SortOrder"] | undefined | null,
	password?: ResolverInputTypes["SortOrder"] | undefined | null,
	permissions?: ResolverInputTypes["SortOrder"] | undefined | null,
	profiles?: ResolverInputTypes["profilesOrderByRelationAggregateInput"] | undefined | null,
	updated_at?: ResolverInputTypes["SortOrder"] | undefined | null,
	username?: ResolverInputTypes["SortOrder"] | undefined | null
};
	["usersWhereInput"]: {
	AND?: Array<ResolverInputTypes["usersWhereInput"]> | undefined | null,
	NOT?: Array<ResolverInputTypes["usersWhereInput"]> | undefined | null,
	OR?: Array<ResolverInputTypes["usersWhereInput"]> | undefined | null,
	created_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null,
	date_of_birth?: ResolverInputTypes["IntFilter"] | undefined | null,
	email?: ResolverInputTypes["StringFilter"] | undefined | null,
	email_verified_at?: ResolverInputTypes["DateTimeNullableFilter"] | undefined | null,
	id?: ResolverInputTypes["StringFilter"] | undefined | null,
	password?: ResolverInputTypes["StringFilter"] | undefined | null,
	permissions?: ResolverInputTypes["EnumpermissionNullableListFilter"] | undefined | null,
	profiles?: ResolverInputTypes["ProfilesListRelationFilter"] | undefined | null,
	updated_at?: ResolverInputTypes["DateTimeFilter"] | undefined | null,
	username?: ResolverInputTypes["StringFilter"] | undefined | null
};
	["usersWhereUniqueInput"]: {
	email?: string | undefined | null,
	id?: string | undefined | null,
	username?: string | undefined | null
}
  }

export type ModelTypes = {
    ["CreateProfileInput"]: {
	bio?: string | undefined,
	description?: string | undefined,
	name: string,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	type: ModelTypes["profile_type"]
};
	["CreateReviewDto"]: {
	category: ModelTypes["review_category"],
	comment?: string | undefined,
	profile_id: string,
	stars?: number | undefined
};
	["CreateTenantFormDto"]: {
	duration_in_months: number,
	email: string,
	name: string,
	phone: string,
	surname: string
};
	["CurrentUserResponseDto"]: {
		email: string,
	id: string,
	permissions: Array<string>,
	username: string
};
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
["DateTime"]:any;
	["DateTimeFilter"]: {
	equals?: ModelTypes["DateTime"] | undefined,
	gt?: ModelTypes["DateTime"] | undefined,
	gte?: ModelTypes["DateTime"] | undefined,
	in?: Array<ModelTypes["DateTime"]> | undefined,
	lt?: ModelTypes["DateTime"] | undefined,
	lte?: ModelTypes["DateTime"] | undefined,
	not?: ModelTypes["NestedDateTimeFilter"] | undefined,
	notIn?: Array<ModelTypes["DateTime"]> | undefined
};
	["DateTimeNullableFilter"]: {
	equals?: ModelTypes["DateTime"] | undefined,
	gt?: ModelTypes["DateTime"] | undefined,
	gte?: ModelTypes["DateTime"] | undefined,
	in?: Array<ModelTypes["DateTime"]> | undefined,
	lt?: ModelTypes["DateTime"] | undefined,
	lte?: ModelTypes["DateTime"] | undefined,
	not?: ModelTypes["NestedDateTimeNullableFilter"] | undefined,
	notIn?: Array<ModelTypes["DateTime"]> | undefined
};
	["EnumpermissionNullableListFilter"]: {
	equals?: Array<ModelTypes["permission"]> | undefined,
	has?: ModelTypes["permission"] | undefined,
	hasEvery?: Array<ModelTypes["permission"]> | undefined,
	hasSome?: Array<ModelTypes["permission"]> | undefined,
	isEmpty?: boolean | undefined
};
	["Enumprofile_typeFilter"]: {
	equals?: ModelTypes["profile_type"] | undefined,
	in?: Array<ModelTypes["profile_type"]> | undefined,
	not?: ModelTypes["NestedEnumprofile_typeFilter"] | undefined,
	notIn?: Array<ModelTypes["profile_type"]> | undefined
};
	["Enumreview_categoryFilter"]: {
	equals?: ModelTypes["review_category"] | undefined,
	in?: Array<ModelTypes["review_category"]> | undefined,
	not?: ModelTypes["NestedEnumreview_categoryFilter"] | undefined,
	notIn?: Array<ModelTypes["review_category"]> | undefined
};
	["IntFilter"]: {
	equals?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	in?: Array<number> | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	not?: ModelTypes["NestedIntFilter"] | undefined,
	notIn?: Array<number> | undefined
};
	["IntNullableFilter"]: {
	equals?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	in?: Array<number> | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	not?: ModelTypes["NestedIntNullableFilter"] | undefined,
	notIn?: Array<number> | undefined
};
	["LoginDto"]: {
	password: string,
	usernameOrEmail: string
};
	["LoginResponseDto"]: {
		accessToken: string,
	refreshToken: string
};
	["Mutation"]: {
		createProfile: string,
	createReview: string,
	createTenantFormSubmission: string,
	createUser: ModelTypes["users"],
	logout: string,
	refreshToken: string,
	signUp: string
};
	["NestedDateTimeFilter"]: {
	equals?: ModelTypes["DateTime"] | undefined,
	gt?: ModelTypes["DateTime"] | undefined,
	gte?: ModelTypes["DateTime"] | undefined,
	in?: Array<ModelTypes["DateTime"]> | undefined,
	lt?: ModelTypes["DateTime"] | undefined,
	lte?: ModelTypes["DateTime"] | undefined,
	not?: ModelTypes["NestedDateTimeFilter"] | undefined,
	notIn?: Array<ModelTypes["DateTime"]> | undefined
};
	["NestedDateTimeNullableFilter"]: {
	equals?: ModelTypes["DateTime"] | undefined,
	gt?: ModelTypes["DateTime"] | undefined,
	gte?: ModelTypes["DateTime"] | undefined,
	in?: Array<ModelTypes["DateTime"]> | undefined,
	lt?: ModelTypes["DateTime"] | undefined,
	lte?: ModelTypes["DateTime"] | undefined,
	not?: ModelTypes["NestedDateTimeNullableFilter"] | undefined,
	notIn?: Array<ModelTypes["DateTime"]> | undefined
};
	["NestedEnumprofile_typeFilter"]: {
	equals?: ModelTypes["profile_type"] | undefined,
	in?: Array<ModelTypes["profile_type"]> | undefined,
	not?: ModelTypes["NestedEnumprofile_typeFilter"] | undefined,
	notIn?: Array<ModelTypes["profile_type"]> | undefined
};
	["NestedEnumreview_categoryFilter"]: {
	equals?: ModelTypes["review_category"] | undefined,
	in?: Array<ModelTypes["review_category"]> | undefined,
	not?: ModelTypes["NestedEnumreview_categoryFilter"] | undefined,
	notIn?: Array<ModelTypes["review_category"]> | undefined
};
	["NestedIntFilter"]: {
	equals?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	in?: Array<number> | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	not?: ModelTypes["NestedIntFilter"] | undefined,
	notIn?: Array<number> | undefined
};
	["NestedIntNullableFilter"]: {
	equals?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	in?: Array<number> | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	not?: ModelTypes["NestedIntNullableFilter"] | undefined,
	notIn?: Array<number> | undefined
};
	["NestedStringFilter"]: {
	contains?: string | undefined,
	endsWith?: string | undefined,
	equals?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	in?: Array<string> | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	not?: ModelTypes["NestedStringFilter"] | undefined,
	notIn?: Array<string> | undefined,
	startsWith?: string | undefined
};
	["NestedStringNullableFilter"]: {
	contains?: string | undefined,
	endsWith?: string | undefined,
	equals?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	in?: Array<string> | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	not?: ModelTypes["NestedStringNullableFilter"] | undefined,
	notIn?: Array<string> | undefined,
	startsWith?: string | undefined
};
	["NullsOrder"]:NullsOrder;
	["PostsCountAggregate"]: {
		_all: number,
	created_at: number,
	description: number,
	id: number,
	media: number,
	profile_id: number,
	title: number,
	updated_at: number
};
	["PostsListRelationFilter"]: {
	every?: ModelTypes["postsWhereInput"] | undefined,
	none?: ModelTypes["postsWhereInput"] | undefined,
	some?: ModelTypes["postsWhereInput"] | undefined
};
	["PostsMaxAggregate"]: {
		created_at?: ModelTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	profile_id?: string | undefined,
	title?: string | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["PostsMinAggregate"]: {
		created_at?: ModelTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	profile_id?: string | undefined,
	title?: string | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["ProfilesCount"]: {
		posts: number,
	received_reviews: number,
	sent_reviews: number,
	tenant_form_submissions: number
};
	["ProfilesCountAggregate"]: {
		_all: number,
	bio: number,
	created_at: number,
	description: number,
	id: number,
	name: number,
	property_city: number,
	property_house_number: number,
	property_postcode: number,
	property_state: number,
	property_street_address: number,
	type: number,
	updated_at: number,
	user_id: number
};
	["ProfilesListRelationFilter"]: {
	every?: ModelTypes["profilesWhereInput"] | undefined,
	none?: ModelTypes["profilesWhereInput"] | undefined,
	some?: ModelTypes["profilesWhereInput"] | undefined
};
	["ProfilesMaxAggregate"]: {
		bio?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name?: string | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	type?: ModelTypes["profile_type"] | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined,
	user_id?: string | undefined
};
	["ProfilesMinAggregate"]: {
		bio?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name?: string | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	type?: ModelTypes["profile_type"] | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined,
	user_id?: string | undefined
};
	["ProfilesRelationFilter"]: {
	is?: ModelTypes["profilesWhereInput"] | undefined,
	isNot?: ModelTypes["profilesWhereInput"] | undefined
};
	["ProfilesScalarFieldEnum"]:ProfilesScalarFieldEnum;
	["Query"]: {
		currentUser: ModelTypes["CurrentUserResponseDto"],
	getAllReviewsByProfileId: Array<ModelTypes["ReviewByProfileResponseDto"]>,
	getAllUsers: Array<ModelTypes["users"]>,
	getProfile: ModelTypes["profiles"],
	getProfiles: Array<ModelTypes["profiles"]>,
	getReviewCategories: Array<ModelTypes["review_category"]>,
	getReviewsOnProfileByLoggedInUser: Array<ModelTypes["reviews"]>,
	login: ModelTypes["LoginResponseDto"]
};
	["QueryMode"]:QueryMode;
	["ReviewByProfileResponseDto"]: {
		id: string,
	name: string,
	sent_reviews: Array<ModelTypes["reviews_scaler_type"]>
};
	["ReviewsAvgAggregate"]: {
		stars?: number | undefined
};
	["ReviewsCountAggregate"]: {
		_all: number,
	category: number,
	comment: number,
	created_at: number,
	id: number,
	received_by_profile_id: number,
	sent_by_profile_id: number,
	stars: number,
	updated_at: number
};
	["ReviewsListRelationFilter"]: {
	every?: ModelTypes["reviewsWhereInput"] | undefined,
	none?: ModelTypes["reviewsWhereInput"] | undefined,
	some?: ModelTypes["reviewsWhereInput"] | undefined
};
	["ReviewsMaxAggregate"]: {
		category?: ModelTypes["review_category"] | undefined,
	comment?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	received_by_profile_id?: string | undefined,
	sent_by_profile_id?: string | undefined,
	stars?: number | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["ReviewsMinAggregate"]: {
		category?: ModelTypes["review_category"] | undefined,
	comment?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	received_by_profile_id?: string | undefined,
	sent_by_profile_id?: string | undefined,
	stars?: number | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["ReviewsSumAggregate"]: {
		stars?: number | undefined
};
	["SignUpDto"]: {
	confirmPassword: string,
	dateOfBirth: number,
	email: string,
	password: string,
	username: string
};
	["SortOrder"]:SortOrder;
	["SortOrderInput"]: {
	nulls?: ModelTypes["NullsOrder"] | undefined,
	sort: ModelTypes["SortOrder"]
};
	["StringFilter"]: {
	contains?: string | undefined,
	endsWith?: string | undefined,
	equals?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	in?: Array<string> | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	mode?: ModelTypes["QueryMode"] | undefined,
	not?: ModelTypes["NestedStringFilter"] | undefined,
	notIn?: Array<string> | undefined,
	startsWith?: string | undefined
};
	["StringNullableFilter"]: {
	contains?: string | undefined,
	endsWith?: string | undefined,
	equals?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	in?: Array<string> | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	mode?: ModelTypes["QueryMode"] | undefined,
	not?: ModelTypes["NestedStringNullableFilter"] | undefined,
	notIn?: Array<string> | undefined,
	startsWith?: string | undefined
};
	["StringNullableListFilter"]: {
	equals?: Array<string> | undefined,
	has?: string | undefined,
	hasEvery?: Array<string> | undefined,
	hasSome?: Array<string> | undefined,
	isEmpty?: boolean | undefined
};
	["Tenant_form_submissionsAvgAggregate"]: {
		duration_in_months?: number | undefined
};
	["Tenant_form_submissionsCountAggregate"]: {
		_all: number,
	created_at: number,
	duration_in_months: number,
	email: number,
	from_profile_id: number,
	id: number,
	name: number,
	phone: number,
	surname: number,
	updated_at: number
};
	["Tenant_form_submissionsListRelationFilter"]: {
	every?: ModelTypes["tenant_form_submissionsWhereInput"] | undefined,
	none?: ModelTypes["tenant_form_submissionsWhereInput"] | undefined,
	some?: ModelTypes["tenant_form_submissionsWhereInput"] | undefined
};
	["Tenant_form_submissionsMaxAggregate"]: {
		created_at?: ModelTypes["DateTime"] | undefined,
	duration_in_months?: number | undefined,
	email?: string | undefined,
	from_profile_id?: string | undefined,
	id?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	surname?: string | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["Tenant_form_submissionsMinAggregate"]: {
		created_at?: ModelTypes["DateTime"] | undefined,
	duration_in_months?: number | undefined,
	email?: string | undefined,
	from_profile_id?: string | undefined,
	id?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	surname?: string | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["Tenant_form_submissionsSumAggregate"]: {
		duration_in_months?: number | undefined
};
	["UsersAvgAggregate"]: {
		date_of_birth?: number | undefined
};
	["UsersCount"]: {
		profiles: number
};
	["UsersCountAggregate"]: {
		_all: number,
	created_at: number,
	date_of_birth: number,
	email: number,
	email_verified_at: number,
	id: number,
	password: number,
	permissions: number,
	updated_at: number,
	username: number
};
	["UsersMaxAggregate"]: {
		created_at?: ModelTypes["DateTime"] | undefined,
	date_of_birth?: number | undefined,
	email?: string | undefined,
	email_verified_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	password?: string | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined,
	username?: string | undefined
};
	["UsersMinAggregate"]: {
		created_at?: ModelTypes["DateTime"] | undefined,
	date_of_birth?: number | undefined,
	email?: string | undefined,
	email_verified_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	password?: string | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined,
	username?: string | undefined
};
	["UsersRelationFilter"]: {
	is?: ModelTypes["usersWhereInput"] | undefined,
	isNot?: ModelTypes["usersWhereInput"] | undefined
};
	["UsersScalarFieldEnum"]:UsersScalarFieldEnum;
	["UsersSumAggregate"]: {
		date_of_birth?: number | undefined
};
	["permission"]:permission;
	["posts"]: {
		created_at: ModelTypes["DateTime"],
	description: string,
	id: string,
	media?: Array<string> | undefined,
	profile_id: string,
	profiles: ModelTypes["profiles"],
	title: string,
	updated_at: ModelTypes["DateTime"]
};
	["postsCreateManyProfilesInput"]: {
	created_at?: ModelTypes["DateTime"] | undefined,
	description: string,
	id?: string | undefined,
	media?: ModelTypes["postsCreatemediaInput"] | undefined,
	title: string,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["postsCreateManyProfilesInputEnvelope"]: {
	data: Array<ModelTypes["postsCreateManyProfilesInput"]>,
	skipDuplicates?: boolean | undefined
};
	["postsCreateNestedManyWithoutProfilesInput"]: {
	connect?: Array<ModelTypes["postsWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<ModelTypes["postsCreateOrConnectWithoutProfilesInput"]> | undefined,
	create?: Array<ModelTypes["postsCreateWithoutProfilesInput"]> | undefined,
	createMany?: ModelTypes["postsCreateManyProfilesInputEnvelope"] | undefined
};
	["postsCreateOrConnectWithoutProfilesInput"]: {
	create: ModelTypes["postsCreateWithoutProfilesInput"],
	where: ModelTypes["postsWhereUniqueInput"]
};
	["postsCreateWithoutProfilesInput"]: {
	created_at?: ModelTypes["DateTime"] | undefined,
	description: string,
	id?: string | undefined,
	media?: ModelTypes["postsCreatemediaInput"] | undefined,
	title: string,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["postsCreatemediaInput"]: {
	set: Array<string>
};
	["postsOrderByRelationAggregateInput"]: {
	_count?: ModelTypes["SortOrder"] | undefined
};
	["postsWhereInput"]: {
	AND?: Array<ModelTypes["postsWhereInput"]> | undefined,
	NOT?: Array<ModelTypes["postsWhereInput"]> | undefined,
	OR?: Array<ModelTypes["postsWhereInput"]> | undefined,
	created_at?: ModelTypes["DateTimeFilter"] | undefined,
	description?: ModelTypes["StringFilter"] | undefined,
	id?: ModelTypes["StringFilter"] | undefined,
	media?: ModelTypes["StringNullableListFilter"] | undefined,
	profile_id?: ModelTypes["StringFilter"] | undefined,
	profiles?: ModelTypes["ProfilesRelationFilter"] | undefined,
	title?: ModelTypes["StringFilter"] | undefined,
	updated_at?: ModelTypes["DateTimeFilter"] | undefined
};
	["postsWhereUniqueInput"]: {
	id?: string | undefined
};
	["profile_type"]:profile_type;
	["profiles"]: {
		_count: ModelTypes["ProfilesCount"],
	bio?: string | undefined,
	created_at: ModelTypes["DateTime"],
	description?: string | undefined,
	id: string,
	name: string,
	posts?: Array<ModelTypes["posts"]> | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	received_reviews?: Array<ModelTypes["reviews"]> | undefined,
	sent_reviews?: Array<ModelTypes["reviews"]> | undefined,
	tenant_form_submissions?: Array<ModelTypes["tenant_form_submissions"]> | undefined,
	type: ModelTypes["profile_type"],
	updated_at: ModelTypes["DateTime"],
	user: ModelTypes["users"],
	user_id: string
};
	["profilesCreateManyUserInput"]: {
	bio?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name: string,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	type: ModelTypes["profile_type"],
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["profilesCreateManyUserInputEnvelope"]: {
	data: Array<ModelTypes["profilesCreateManyUserInput"]>,
	skipDuplicates?: boolean | undefined
};
	["profilesCreateNestedManyWithoutUserInput"]: {
	connect?: Array<ModelTypes["profilesWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<ModelTypes["profilesCreateOrConnectWithoutUserInput"]> | undefined,
	create?: Array<ModelTypes["profilesCreateWithoutUserInput"]> | undefined,
	createMany?: ModelTypes["profilesCreateManyUserInputEnvelope"] | undefined
};
	["profilesCreateNestedOneWithoutReceived_reviewsInput"]: {
	connect?: ModelTypes["profilesWhereUniqueInput"] | undefined,
	connectOrCreate?: ModelTypes["profilesCreateOrConnectWithoutReceived_reviewsInput"] | undefined,
	create?: ModelTypes["profilesCreateWithoutReceived_reviewsInput"] | undefined
};
	["profilesCreateNestedOneWithoutSent_reviewsInput"]: {
	connect?: ModelTypes["profilesWhereUniqueInput"] | undefined,
	connectOrCreate?: ModelTypes["profilesCreateOrConnectWithoutSent_reviewsInput"] | undefined,
	create?: ModelTypes["profilesCreateWithoutSent_reviewsInput"] | undefined
};
	["profilesCreateOrConnectWithoutReceived_reviewsInput"]: {
	create: ModelTypes["profilesCreateWithoutReceived_reviewsInput"],
	where: ModelTypes["profilesWhereUniqueInput"]
};
	["profilesCreateOrConnectWithoutSent_reviewsInput"]: {
	create: ModelTypes["profilesCreateWithoutSent_reviewsInput"],
	where: ModelTypes["profilesWhereUniqueInput"]
};
	["profilesCreateOrConnectWithoutUserInput"]: {
	create: ModelTypes["profilesCreateWithoutUserInput"],
	where: ModelTypes["profilesWhereUniqueInput"]
};
	["profilesCreateWithoutReceived_reviewsInput"]: {
	bio?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name: string,
	posts?: ModelTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	sent_reviews?: ModelTypes["reviewsCreateNestedManyWithoutSent_by_profileInput"] | undefined,
	tenant_form_submissions?: ModelTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined,
	type: ModelTypes["profile_type"],
	updated_at?: ModelTypes["DateTime"] | undefined,
	user: ModelTypes["usersCreateNestedOneWithoutProfilesInput"]
};
	["profilesCreateWithoutSent_reviewsInput"]: {
	bio?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name: string,
	posts?: ModelTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	received_reviews?: ModelTypes["reviewsCreateNestedManyWithoutReceived_by_profileInput"] | undefined,
	tenant_form_submissions?: ModelTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined,
	type: ModelTypes["profile_type"],
	updated_at?: ModelTypes["DateTime"] | undefined,
	user: ModelTypes["usersCreateNestedOneWithoutProfilesInput"]
};
	["profilesCreateWithoutUserInput"]: {
	bio?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name: string,
	posts?: ModelTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	received_reviews?: ModelTypes["reviewsCreateNestedManyWithoutReceived_by_profileInput"] | undefined,
	sent_reviews?: ModelTypes["reviewsCreateNestedManyWithoutSent_by_profileInput"] | undefined,
	tenant_form_submissions?: ModelTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined,
	type: ModelTypes["profile_type"],
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["profilesOrderByRelationAggregateInput"]: {
	_count?: ModelTypes["SortOrder"] | undefined
};
	["profilesOrderByWithRelationInput"]: {
	bio?: ModelTypes["SortOrderInput"] | undefined,
	created_at?: ModelTypes["SortOrder"] | undefined,
	description?: ModelTypes["SortOrderInput"] | undefined,
	id?: ModelTypes["SortOrder"] | undefined,
	name?: ModelTypes["SortOrder"] | undefined,
	posts?: ModelTypes["postsOrderByRelationAggregateInput"] | undefined,
	property_city?: ModelTypes["SortOrderInput"] | undefined,
	property_house_number?: ModelTypes["SortOrderInput"] | undefined,
	property_postcode?: ModelTypes["SortOrderInput"] | undefined,
	property_state?: ModelTypes["SortOrderInput"] | undefined,
	property_street_address?: ModelTypes["SortOrderInput"] | undefined,
	received_reviews?: ModelTypes["reviewsOrderByRelationAggregateInput"] | undefined,
	sent_reviews?: ModelTypes["reviewsOrderByRelationAggregateInput"] | undefined,
	tenant_form_submissions?: ModelTypes["tenant_form_submissionsOrderByRelationAggregateInput"] | undefined,
	type?: ModelTypes["SortOrder"] | undefined,
	updated_at?: ModelTypes["SortOrder"] | undefined,
	user?: ModelTypes["usersOrderByWithRelationInput"] | undefined,
	user_id?: ModelTypes["SortOrder"] | undefined
};
	["profilesUser_idTypeCompoundUniqueInput"]: {
	type: ModelTypes["profile_type"],
	user_id: string
};
	["profilesWhereInput"]: {
	AND?: Array<ModelTypes["profilesWhereInput"]> | undefined,
	NOT?: Array<ModelTypes["profilesWhereInput"]> | undefined,
	OR?: Array<ModelTypes["profilesWhereInput"]> | undefined,
	bio?: ModelTypes["StringNullableFilter"] | undefined,
	created_at?: ModelTypes["DateTimeFilter"] | undefined,
	description?: ModelTypes["StringNullableFilter"] | undefined,
	id?: ModelTypes["StringFilter"] | undefined,
	name?: ModelTypes["StringFilter"] | undefined,
	posts?: ModelTypes["PostsListRelationFilter"] | undefined,
	property_city?: ModelTypes["StringNullableFilter"] | undefined,
	property_house_number?: ModelTypes["StringNullableFilter"] | undefined,
	property_postcode?: ModelTypes["StringNullableFilter"] | undefined,
	property_state?: ModelTypes["StringNullableFilter"] | undefined,
	property_street_address?: ModelTypes["StringNullableFilter"] | undefined,
	received_reviews?: ModelTypes["ReviewsListRelationFilter"] | undefined,
	sent_reviews?: ModelTypes["ReviewsListRelationFilter"] | undefined,
	tenant_form_submissions?: ModelTypes["Tenant_form_submissionsListRelationFilter"] | undefined,
	type?: ModelTypes["Enumprofile_typeFilter"] | undefined,
	updated_at?: ModelTypes["DateTimeFilter"] | undefined,
	user?: ModelTypes["UsersRelationFilter"] | undefined,
	user_id?: ModelTypes["StringFilter"] | undefined
};
	["profilesWhereUniqueInput"]: {
	id?: string | undefined,
	user_id_type?: ModelTypes["profilesUser_idTypeCompoundUniqueInput"] | undefined
};
	["review_category"]:review_category;
	["reviews"]: {
		category: ModelTypes["review_category"],
	comment?: string | undefined,
	created_at: ModelTypes["DateTime"],
	id: string,
	received_by_profile: ModelTypes["profiles"],
	received_by_profile_id: string,
	sent_by_profile: ModelTypes["profiles"],
	sent_by_profile_id: string,
	stars?: number | undefined,
	updated_at: ModelTypes["DateTime"]
};
	["reviewsCreateManyReceived_by_profileInput"]: {
	category: ModelTypes["review_category"],
	comment?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	sent_by_profile_id: string,
	stars?: number | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["reviewsCreateManyReceived_by_profileInputEnvelope"]: {
	data: Array<ModelTypes["reviewsCreateManyReceived_by_profileInput"]>,
	skipDuplicates?: boolean | undefined
};
	["reviewsCreateManySent_by_profileInput"]: {
	category: ModelTypes["review_category"],
	comment?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	received_by_profile_id: string,
	stars?: number | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["reviewsCreateManySent_by_profileInputEnvelope"]: {
	data: Array<ModelTypes["reviewsCreateManySent_by_profileInput"]>,
	skipDuplicates?: boolean | undefined
};
	["reviewsCreateNestedManyWithoutReceived_by_profileInput"]: {
	connect?: Array<ModelTypes["reviewsWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<ModelTypes["reviewsCreateOrConnectWithoutReceived_by_profileInput"]> | undefined,
	create?: Array<ModelTypes["reviewsCreateWithoutReceived_by_profileInput"]> | undefined,
	createMany?: ModelTypes["reviewsCreateManyReceived_by_profileInputEnvelope"] | undefined
};
	["reviewsCreateNestedManyWithoutSent_by_profileInput"]: {
	connect?: Array<ModelTypes["reviewsWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<ModelTypes["reviewsCreateOrConnectWithoutSent_by_profileInput"]> | undefined,
	create?: Array<ModelTypes["reviewsCreateWithoutSent_by_profileInput"]> | undefined,
	createMany?: ModelTypes["reviewsCreateManySent_by_profileInputEnvelope"] | undefined
};
	["reviewsCreateOrConnectWithoutReceived_by_profileInput"]: {
	create: ModelTypes["reviewsCreateWithoutReceived_by_profileInput"],
	where: ModelTypes["reviewsWhereUniqueInput"]
};
	["reviewsCreateOrConnectWithoutSent_by_profileInput"]: {
	create: ModelTypes["reviewsCreateWithoutSent_by_profileInput"],
	where: ModelTypes["reviewsWhereUniqueInput"]
};
	["reviewsCreateWithoutReceived_by_profileInput"]: {
	category: ModelTypes["review_category"],
	comment?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	sent_by_profile: ModelTypes["profilesCreateNestedOneWithoutSent_reviewsInput"],
	stars?: number | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["reviewsCreateWithoutSent_by_profileInput"]: {
	category: ModelTypes["review_category"],
	comment?: string | undefined,
	created_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	received_by_profile: ModelTypes["profilesCreateNestedOneWithoutReceived_reviewsInput"],
	stars?: number | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["reviewsOrderByRelationAggregateInput"]: {
	_count?: ModelTypes["SortOrder"] | undefined
};
	["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"]: {
	category: ModelTypes["review_category"],
	received_by_profile_id: string,
	sent_by_profile_id: string
};
	["reviewsWhereInput"]: {
	AND?: Array<ModelTypes["reviewsWhereInput"]> | undefined,
	NOT?: Array<ModelTypes["reviewsWhereInput"]> | undefined,
	OR?: Array<ModelTypes["reviewsWhereInput"]> | undefined,
	category?: ModelTypes["Enumreview_categoryFilter"] | undefined,
	comment?: ModelTypes["StringNullableFilter"] | undefined,
	created_at?: ModelTypes["DateTimeFilter"] | undefined,
	id?: ModelTypes["StringFilter"] | undefined,
	received_by_profile?: ModelTypes["ProfilesRelationFilter"] | undefined,
	received_by_profile_id?: ModelTypes["StringFilter"] | undefined,
	sent_by_profile?: ModelTypes["ProfilesRelationFilter"] | undefined,
	sent_by_profile_id?: ModelTypes["StringFilter"] | undefined,
	stars?: ModelTypes["IntNullableFilter"] | undefined,
	updated_at?: ModelTypes["DateTimeFilter"] | undefined
};
	["reviewsWhereUniqueInput"]: {
	id?: string | undefined,
	sent_by_profile_id_received_by_profile_id_category?: ModelTypes["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"] | undefined
};
	["reviews_scaler_type"]: {
		category: ModelTypes["review_category"],
	comment?: string | undefined,
	created_at: ModelTypes["DateTime"],
	id: string,
	received_by_profile_id: string,
	sent_by_profile_id: string,
	stars?: number | undefined,
	updated_at: ModelTypes["DateTime"]
};
	["tenant_form_submissions"]: {
		created_at: ModelTypes["DateTime"],
	duration_in_months: number,
	email: string,
	from_profile_id: string,
	id: string,
	name: string,
	phone: string,
	profiles: ModelTypes["profiles"],
	surname: string,
	updated_at: ModelTypes["DateTime"]
};
	["tenant_form_submissionsCreateManyProfilesInput"]: {
	created_at?: ModelTypes["DateTime"] | undefined,
	duration_in_months: number,
	email: string,
	id?: string | undefined,
	name: string,
	phone: string,
	surname: string,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["tenant_form_submissionsCreateManyProfilesInputEnvelope"]: {
	data: Array<ModelTypes["tenant_form_submissionsCreateManyProfilesInput"]>,
	skipDuplicates?: boolean | undefined
};
	["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"]: {
	connect?: Array<ModelTypes["tenant_form_submissionsWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<ModelTypes["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"]> | undefined,
	create?: Array<ModelTypes["tenant_form_submissionsCreateWithoutProfilesInput"]> | undefined,
	createMany?: ModelTypes["tenant_form_submissionsCreateManyProfilesInputEnvelope"] | undefined
};
	["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"]: {
	create: ModelTypes["tenant_form_submissionsCreateWithoutProfilesInput"],
	where: ModelTypes["tenant_form_submissionsWhereUniqueInput"]
};
	["tenant_form_submissionsCreateWithoutProfilesInput"]: {
	created_at?: ModelTypes["DateTime"] | undefined,
	duration_in_months: number,
	email: string,
	id?: string | undefined,
	name: string,
	phone: string,
	surname: string,
	updated_at?: ModelTypes["DateTime"] | undefined
};
	["tenant_form_submissionsOrderByRelationAggregateInput"]: {
	_count?: ModelTypes["SortOrder"] | undefined
};
	["tenant_form_submissionsWhereInput"]: {
	AND?: Array<ModelTypes["tenant_form_submissionsWhereInput"]> | undefined,
	NOT?: Array<ModelTypes["tenant_form_submissionsWhereInput"]> | undefined,
	OR?: Array<ModelTypes["tenant_form_submissionsWhereInput"]> | undefined,
	created_at?: ModelTypes["DateTimeFilter"] | undefined,
	duration_in_months?: ModelTypes["IntFilter"] | undefined,
	email?: ModelTypes["StringFilter"] | undefined,
	from_profile_id?: ModelTypes["StringFilter"] | undefined,
	id?: ModelTypes["StringFilter"] | undefined,
	name?: ModelTypes["StringFilter"] | undefined,
	phone?: ModelTypes["StringFilter"] | undefined,
	profiles?: ModelTypes["ProfilesRelationFilter"] | undefined,
	surname?: ModelTypes["StringFilter"] | undefined,
	updated_at?: ModelTypes["DateTimeFilter"] | undefined
};
	["tenant_form_submissionsWhereUniqueInput"]: {
	id?: string | undefined
};
	["users"]: {
		_count: ModelTypes["UsersCount"],
	created_at: ModelTypes["DateTime"],
	date_of_birth: number,
	email: string,
	email_verified_at?: ModelTypes["DateTime"] | undefined,
	id: string,
	password: string,
	permissions?: Array<ModelTypes["permission"]> | undefined,
	profiles?: Array<ModelTypes["profiles"]> | undefined,
	updated_at: ModelTypes["DateTime"],
	username: string
};
	["usersCreateInput"]: {
	created_at?: ModelTypes["DateTime"] | undefined,
	date_of_birth: number,
	email: string,
	email_verified_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	password: string,
	permissions?: ModelTypes["usersCreatepermissionsInput"] | undefined,
	profiles?: ModelTypes["profilesCreateNestedManyWithoutUserInput"] | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined,
	username: string
};
	["usersCreateNestedOneWithoutProfilesInput"]: {
	connect?: ModelTypes["usersWhereUniqueInput"] | undefined,
	connectOrCreate?: ModelTypes["usersCreateOrConnectWithoutProfilesInput"] | undefined,
	create?: ModelTypes["usersCreateWithoutProfilesInput"] | undefined
};
	["usersCreateOrConnectWithoutProfilesInput"]: {
	create: ModelTypes["usersCreateWithoutProfilesInput"],
	where: ModelTypes["usersWhereUniqueInput"]
};
	["usersCreateWithoutProfilesInput"]: {
	created_at?: ModelTypes["DateTime"] | undefined,
	date_of_birth: number,
	email: string,
	email_verified_at?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	password: string,
	permissions?: ModelTypes["usersCreatepermissionsInput"] | undefined,
	updated_at?: ModelTypes["DateTime"] | undefined,
	username: string
};
	["usersCreatepermissionsInput"]: {
	set: Array<ModelTypes["permission"]>
};
	["usersOrderByWithRelationInput"]: {
	created_at?: ModelTypes["SortOrder"] | undefined,
	date_of_birth?: ModelTypes["SortOrder"] | undefined,
	email?: ModelTypes["SortOrder"] | undefined,
	email_verified_at?: ModelTypes["SortOrderInput"] | undefined,
	id?: ModelTypes["SortOrder"] | undefined,
	password?: ModelTypes["SortOrder"] | undefined,
	permissions?: ModelTypes["SortOrder"] | undefined,
	profiles?: ModelTypes["profilesOrderByRelationAggregateInput"] | undefined,
	updated_at?: ModelTypes["SortOrder"] | undefined,
	username?: ModelTypes["SortOrder"] | undefined
};
	["usersWhereInput"]: {
	AND?: Array<ModelTypes["usersWhereInput"]> | undefined,
	NOT?: Array<ModelTypes["usersWhereInput"]> | undefined,
	OR?: Array<ModelTypes["usersWhereInput"]> | undefined,
	created_at?: ModelTypes["DateTimeFilter"] | undefined,
	date_of_birth?: ModelTypes["IntFilter"] | undefined,
	email?: ModelTypes["StringFilter"] | undefined,
	email_verified_at?: ModelTypes["DateTimeNullableFilter"] | undefined,
	id?: ModelTypes["StringFilter"] | undefined,
	password?: ModelTypes["StringFilter"] | undefined,
	permissions?: ModelTypes["EnumpermissionNullableListFilter"] | undefined,
	profiles?: ModelTypes["ProfilesListRelationFilter"] | undefined,
	updated_at?: ModelTypes["DateTimeFilter"] | undefined,
	username?: ModelTypes["StringFilter"] | undefined
};
	["usersWhereUniqueInput"]: {
	email?: string | undefined,
	id?: string | undefined,
	username?: string | undefined
}
    }

export type GraphQLTypes = {
    ["CreateProfileInput"]: {
		bio?: string | undefined,
	description?: string | undefined,
	name: string,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	type: GraphQLTypes["profile_type"]
};
	["CreateReviewDto"]: {
		category: GraphQLTypes["review_category"],
	comment?: string | undefined,
	profile_id: string,
	stars?: number | undefined
};
	["CreateTenantFormDto"]: {
		duration_in_months: number,
	email: string,
	name: string,
	phone: string,
	surname: string
};
	["CurrentUserResponseDto"]: {
	__typename: "CurrentUserResponseDto",
	email: string,
	id: string,
	permissions: Array<string>,
	username: string
};
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
["DateTime"]: "scalar" & { name: "DateTime" };
	["DateTimeFilter"]: {
		equals?: GraphQLTypes["DateTime"] | undefined,
	gt?: GraphQLTypes["DateTime"] | undefined,
	gte?: GraphQLTypes["DateTime"] | undefined,
	in?: Array<GraphQLTypes["DateTime"]> | undefined,
	lt?: GraphQLTypes["DateTime"] | undefined,
	lte?: GraphQLTypes["DateTime"] | undefined,
	not?: GraphQLTypes["NestedDateTimeFilter"] | undefined,
	notIn?: Array<GraphQLTypes["DateTime"]> | undefined
};
	["DateTimeNullableFilter"]: {
		equals?: GraphQLTypes["DateTime"] | undefined,
	gt?: GraphQLTypes["DateTime"] | undefined,
	gte?: GraphQLTypes["DateTime"] | undefined,
	in?: Array<GraphQLTypes["DateTime"]> | undefined,
	lt?: GraphQLTypes["DateTime"] | undefined,
	lte?: GraphQLTypes["DateTime"] | undefined,
	not?: GraphQLTypes["NestedDateTimeNullableFilter"] | undefined,
	notIn?: Array<GraphQLTypes["DateTime"]> | undefined
};
	["EnumpermissionNullableListFilter"]: {
		equals?: Array<GraphQLTypes["permission"]> | undefined,
	has?: GraphQLTypes["permission"] | undefined,
	hasEvery?: Array<GraphQLTypes["permission"]> | undefined,
	hasSome?: Array<GraphQLTypes["permission"]> | undefined,
	isEmpty?: boolean | undefined
};
	["Enumprofile_typeFilter"]: {
		equals?: GraphQLTypes["profile_type"] | undefined,
	in?: Array<GraphQLTypes["profile_type"]> | undefined,
	not?: GraphQLTypes["NestedEnumprofile_typeFilter"] | undefined,
	notIn?: Array<GraphQLTypes["profile_type"]> | undefined
};
	["Enumreview_categoryFilter"]: {
		equals?: GraphQLTypes["review_category"] | undefined,
	in?: Array<GraphQLTypes["review_category"]> | undefined,
	not?: GraphQLTypes["NestedEnumreview_categoryFilter"] | undefined,
	notIn?: Array<GraphQLTypes["review_category"]> | undefined
};
	["IntFilter"]: {
		equals?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	in?: Array<number> | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	not?: GraphQLTypes["NestedIntFilter"] | undefined,
	notIn?: Array<number> | undefined
};
	["IntNullableFilter"]: {
		equals?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	in?: Array<number> | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	not?: GraphQLTypes["NestedIntNullableFilter"] | undefined,
	notIn?: Array<number> | undefined
};
	["LoginDto"]: {
		password: string,
	usernameOrEmail: string
};
	["LoginResponseDto"]: {
	__typename: "LoginResponseDto",
	accessToken: string,
	refreshToken: string
};
	["Mutation"]: {
	__typename: "Mutation",
	createProfile: string,
	createReview: string,
	createTenantFormSubmission: string,
	createUser: GraphQLTypes["users"],
	logout: string,
	refreshToken: string,
	signUp: string
};
	["NestedDateTimeFilter"]: {
		equals?: GraphQLTypes["DateTime"] | undefined,
	gt?: GraphQLTypes["DateTime"] | undefined,
	gte?: GraphQLTypes["DateTime"] | undefined,
	in?: Array<GraphQLTypes["DateTime"]> | undefined,
	lt?: GraphQLTypes["DateTime"] | undefined,
	lte?: GraphQLTypes["DateTime"] | undefined,
	not?: GraphQLTypes["NestedDateTimeFilter"] | undefined,
	notIn?: Array<GraphQLTypes["DateTime"]> | undefined
};
	["NestedDateTimeNullableFilter"]: {
		equals?: GraphQLTypes["DateTime"] | undefined,
	gt?: GraphQLTypes["DateTime"] | undefined,
	gte?: GraphQLTypes["DateTime"] | undefined,
	in?: Array<GraphQLTypes["DateTime"]> | undefined,
	lt?: GraphQLTypes["DateTime"] | undefined,
	lte?: GraphQLTypes["DateTime"] | undefined,
	not?: GraphQLTypes["NestedDateTimeNullableFilter"] | undefined,
	notIn?: Array<GraphQLTypes["DateTime"]> | undefined
};
	["NestedEnumprofile_typeFilter"]: {
		equals?: GraphQLTypes["profile_type"] | undefined,
	in?: Array<GraphQLTypes["profile_type"]> | undefined,
	not?: GraphQLTypes["NestedEnumprofile_typeFilter"] | undefined,
	notIn?: Array<GraphQLTypes["profile_type"]> | undefined
};
	["NestedEnumreview_categoryFilter"]: {
		equals?: GraphQLTypes["review_category"] | undefined,
	in?: Array<GraphQLTypes["review_category"]> | undefined,
	not?: GraphQLTypes["NestedEnumreview_categoryFilter"] | undefined,
	notIn?: Array<GraphQLTypes["review_category"]> | undefined
};
	["NestedIntFilter"]: {
		equals?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	in?: Array<number> | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	not?: GraphQLTypes["NestedIntFilter"] | undefined,
	notIn?: Array<number> | undefined
};
	["NestedIntNullableFilter"]: {
		equals?: number | undefined,
	gt?: number | undefined,
	gte?: number | undefined,
	in?: Array<number> | undefined,
	lt?: number | undefined,
	lte?: number | undefined,
	not?: GraphQLTypes["NestedIntNullableFilter"] | undefined,
	notIn?: Array<number> | undefined
};
	["NestedStringFilter"]: {
		contains?: string | undefined,
	endsWith?: string | undefined,
	equals?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	in?: Array<string> | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	not?: GraphQLTypes["NestedStringFilter"] | undefined,
	notIn?: Array<string> | undefined,
	startsWith?: string | undefined
};
	["NestedStringNullableFilter"]: {
		contains?: string | undefined,
	endsWith?: string | undefined,
	equals?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	in?: Array<string> | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	not?: GraphQLTypes["NestedStringNullableFilter"] | undefined,
	notIn?: Array<string> | undefined,
	startsWith?: string | undefined
};
	["NullsOrder"]: NullsOrder;
	["PostsCountAggregate"]: {
	__typename: "PostsCountAggregate",
	_all: number,
	created_at: number,
	description: number,
	id: number,
	media: number,
	profile_id: number,
	title: number,
	updated_at: number
};
	["PostsListRelationFilter"]: {
		every?: GraphQLTypes["postsWhereInput"] | undefined,
	none?: GraphQLTypes["postsWhereInput"] | undefined,
	some?: GraphQLTypes["postsWhereInput"] | undefined
};
	["PostsMaxAggregate"]: {
	__typename: "PostsMaxAggregate",
	created_at?: GraphQLTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	profile_id?: string | undefined,
	title?: string | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["PostsMinAggregate"]: {
	__typename: "PostsMinAggregate",
	created_at?: GraphQLTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	profile_id?: string | undefined,
	title?: string | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["ProfilesCount"]: {
	__typename: "ProfilesCount",
	posts: number,
	received_reviews: number,
	sent_reviews: number,
	tenant_form_submissions: number
};
	["ProfilesCountAggregate"]: {
	__typename: "ProfilesCountAggregate",
	_all: number,
	bio: number,
	created_at: number,
	description: number,
	id: number,
	name: number,
	property_city: number,
	property_house_number: number,
	property_postcode: number,
	property_state: number,
	property_street_address: number,
	type: number,
	updated_at: number,
	user_id: number
};
	["ProfilesListRelationFilter"]: {
		every?: GraphQLTypes["profilesWhereInput"] | undefined,
	none?: GraphQLTypes["profilesWhereInput"] | undefined,
	some?: GraphQLTypes["profilesWhereInput"] | undefined
};
	["ProfilesMaxAggregate"]: {
	__typename: "ProfilesMaxAggregate",
	bio?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name?: string | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	type?: GraphQLTypes["profile_type"] | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined,
	user_id?: string | undefined
};
	["ProfilesMinAggregate"]: {
	__typename: "ProfilesMinAggregate",
	bio?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name?: string | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	type?: GraphQLTypes["profile_type"] | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined,
	user_id?: string | undefined
};
	["ProfilesRelationFilter"]: {
		is?: GraphQLTypes["profilesWhereInput"] | undefined,
	isNot?: GraphQLTypes["profilesWhereInput"] | undefined
};
	["ProfilesScalarFieldEnum"]: ProfilesScalarFieldEnum;
	["Query"]: {
	__typename: "Query",
	currentUser: GraphQLTypes["CurrentUserResponseDto"],
	getAllReviewsByProfileId: Array<GraphQLTypes["ReviewByProfileResponseDto"]>,
	getAllUsers: Array<GraphQLTypes["users"]>,
	getProfile: GraphQLTypes["profiles"],
	getProfiles: Array<GraphQLTypes["profiles"]>,
	getReviewCategories: Array<GraphQLTypes["review_category"]>,
	getReviewsOnProfileByLoggedInUser: Array<GraphQLTypes["reviews"]>,
	login: GraphQLTypes["LoginResponseDto"]
};
	["QueryMode"]: QueryMode;
	["ReviewByProfileResponseDto"]: {
	__typename: "ReviewByProfileResponseDto",
	id: string,
	name: string,
	sent_reviews: Array<GraphQLTypes["reviews_scaler_type"]>
};
	["ReviewsAvgAggregate"]: {
	__typename: "ReviewsAvgAggregate",
	stars?: number | undefined
};
	["ReviewsCountAggregate"]: {
	__typename: "ReviewsCountAggregate",
	_all: number,
	category: number,
	comment: number,
	created_at: number,
	id: number,
	received_by_profile_id: number,
	sent_by_profile_id: number,
	stars: number,
	updated_at: number
};
	["ReviewsListRelationFilter"]: {
		every?: GraphQLTypes["reviewsWhereInput"] | undefined,
	none?: GraphQLTypes["reviewsWhereInput"] | undefined,
	some?: GraphQLTypes["reviewsWhereInput"] | undefined
};
	["ReviewsMaxAggregate"]: {
	__typename: "ReviewsMaxAggregate",
	category?: GraphQLTypes["review_category"] | undefined,
	comment?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	received_by_profile_id?: string | undefined,
	sent_by_profile_id?: string | undefined,
	stars?: number | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["ReviewsMinAggregate"]: {
	__typename: "ReviewsMinAggregate",
	category?: GraphQLTypes["review_category"] | undefined,
	comment?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	received_by_profile_id?: string | undefined,
	sent_by_profile_id?: string | undefined,
	stars?: number | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["ReviewsSumAggregate"]: {
	__typename: "ReviewsSumAggregate",
	stars?: number | undefined
};
	["SignUpDto"]: {
		confirmPassword: string,
	dateOfBirth: number,
	email: string,
	password: string,
	username: string
};
	["SortOrder"]: SortOrder;
	["SortOrderInput"]: {
		nulls?: GraphQLTypes["NullsOrder"] | undefined,
	sort: GraphQLTypes["SortOrder"]
};
	["StringFilter"]: {
		contains?: string | undefined,
	endsWith?: string | undefined,
	equals?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	in?: Array<string> | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	mode?: GraphQLTypes["QueryMode"] | undefined,
	not?: GraphQLTypes["NestedStringFilter"] | undefined,
	notIn?: Array<string> | undefined,
	startsWith?: string | undefined
};
	["StringNullableFilter"]: {
		contains?: string | undefined,
	endsWith?: string | undefined,
	equals?: string | undefined,
	gt?: string | undefined,
	gte?: string | undefined,
	in?: Array<string> | undefined,
	lt?: string | undefined,
	lte?: string | undefined,
	mode?: GraphQLTypes["QueryMode"] | undefined,
	not?: GraphQLTypes["NestedStringNullableFilter"] | undefined,
	notIn?: Array<string> | undefined,
	startsWith?: string | undefined
};
	["StringNullableListFilter"]: {
		equals?: Array<string> | undefined,
	has?: string | undefined,
	hasEvery?: Array<string> | undefined,
	hasSome?: Array<string> | undefined,
	isEmpty?: boolean | undefined
};
	["Tenant_form_submissionsAvgAggregate"]: {
	__typename: "Tenant_form_submissionsAvgAggregate",
	duration_in_months?: number | undefined
};
	["Tenant_form_submissionsCountAggregate"]: {
	__typename: "Tenant_form_submissionsCountAggregate",
	_all: number,
	created_at: number,
	duration_in_months: number,
	email: number,
	from_profile_id: number,
	id: number,
	name: number,
	phone: number,
	surname: number,
	updated_at: number
};
	["Tenant_form_submissionsListRelationFilter"]: {
		every?: GraphQLTypes["tenant_form_submissionsWhereInput"] | undefined,
	none?: GraphQLTypes["tenant_form_submissionsWhereInput"] | undefined,
	some?: GraphQLTypes["tenant_form_submissionsWhereInput"] | undefined
};
	["Tenant_form_submissionsMaxAggregate"]: {
	__typename: "Tenant_form_submissionsMaxAggregate",
	created_at?: GraphQLTypes["DateTime"] | undefined,
	duration_in_months?: number | undefined,
	email?: string | undefined,
	from_profile_id?: string | undefined,
	id?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	surname?: string | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["Tenant_form_submissionsMinAggregate"]: {
	__typename: "Tenant_form_submissionsMinAggregate",
	created_at?: GraphQLTypes["DateTime"] | undefined,
	duration_in_months?: number | undefined,
	email?: string | undefined,
	from_profile_id?: string | undefined,
	id?: string | undefined,
	name?: string | undefined,
	phone?: string | undefined,
	surname?: string | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["Tenant_form_submissionsSumAggregate"]: {
	__typename: "Tenant_form_submissionsSumAggregate",
	duration_in_months?: number | undefined
};
	["UsersAvgAggregate"]: {
	__typename: "UsersAvgAggregate",
	date_of_birth?: number | undefined
};
	["UsersCount"]: {
	__typename: "UsersCount",
	profiles: number
};
	["UsersCountAggregate"]: {
	__typename: "UsersCountAggregate",
	_all: number,
	created_at: number,
	date_of_birth: number,
	email: number,
	email_verified_at: number,
	id: number,
	password: number,
	permissions: number,
	updated_at: number,
	username: number
};
	["UsersMaxAggregate"]: {
	__typename: "UsersMaxAggregate",
	created_at?: GraphQLTypes["DateTime"] | undefined,
	date_of_birth?: number | undefined,
	email?: string | undefined,
	email_verified_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	password?: string | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined,
	username?: string | undefined
};
	["UsersMinAggregate"]: {
	__typename: "UsersMinAggregate",
	created_at?: GraphQLTypes["DateTime"] | undefined,
	date_of_birth?: number | undefined,
	email?: string | undefined,
	email_verified_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	password?: string | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined,
	username?: string | undefined
};
	["UsersRelationFilter"]: {
		is?: GraphQLTypes["usersWhereInput"] | undefined,
	isNot?: GraphQLTypes["usersWhereInput"] | undefined
};
	["UsersScalarFieldEnum"]: UsersScalarFieldEnum;
	["UsersSumAggregate"]: {
	__typename: "UsersSumAggregate",
	date_of_birth?: number | undefined
};
	["permission"]: permission;
	["posts"]: {
	__typename: "posts",
	created_at: GraphQLTypes["DateTime"],
	description: string,
	id: string,
	media?: Array<string> | undefined,
	profile_id: string,
	profiles: GraphQLTypes["profiles"],
	title: string,
	updated_at: GraphQLTypes["DateTime"]
};
	["postsCreateManyProfilesInput"]: {
		created_at?: GraphQLTypes["DateTime"] | undefined,
	description: string,
	id?: string | undefined,
	media?: GraphQLTypes["postsCreatemediaInput"] | undefined,
	title: string,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["postsCreateManyProfilesInputEnvelope"]: {
		data: Array<GraphQLTypes["postsCreateManyProfilesInput"]>,
	skipDuplicates?: boolean | undefined
};
	["postsCreateNestedManyWithoutProfilesInput"]: {
		connect?: Array<GraphQLTypes["postsWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<GraphQLTypes["postsCreateOrConnectWithoutProfilesInput"]> | undefined,
	create?: Array<GraphQLTypes["postsCreateWithoutProfilesInput"]> | undefined,
	createMany?: GraphQLTypes["postsCreateManyProfilesInputEnvelope"] | undefined
};
	["postsCreateOrConnectWithoutProfilesInput"]: {
		create: GraphQLTypes["postsCreateWithoutProfilesInput"],
	where: GraphQLTypes["postsWhereUniqueInput"]
};
	["postsCreateWithoutProfilesInput"]: {
		created_at?: GraphQLTypes["DateTime"] | undefined,
	description: string,
	id?: string | undefined,
	media?: GraphQLTypes["postsCreatemediaInput"] | undefined,
	title: string,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["postsCreatemediaInput"]: {
		set: Array<string>
};
	["postsOrderByRelationAggregateInput"]: {
		_count?: GraphQLTypes["SortOrder"] | undefined
};
	["postsWhereInput"]: {
		AND?: Array<GraphQLTypes["postsWhereInput"]> | undefined,
	NOT?: Array<GraphQLTypes["postsWhereInput"]> | undefined,
	OR?: Array<GraphQLTypes["postsWhereInput"]> | undefined,
	created_at?: GraphQLTypes["DateTimeFilter"] | undefined,
	description?: GraphQLTypes["StringFilter"] | undefined,
	id?: GraphQLTypes["StringFilter"] | undefined,
	media?: GraphQLTypes["StringNullableListFilter"] | undefined,
	profile_id?: GraphQLTypes["StringFilter"] | undefined,
	profiles?: GraphQLTypes["ProfilesRelationFilter"] | undefined,
	title?: GraphQLTypes["StringFilter"] | undefined,
	updated_at?: GraphQLTypes["DateTimeFilter"] | undefined
};
	["postsWhereUniqueInput"]: {
		id?: string | undefined
};
	["profile_type"]: profile_type;
	["profiles"]: {
	__typename: "profiles",
	_count: GraphQLTypes["ProfilesCount"],
	bio?: string | undefined,
	created_at: GraphQLTypes["DateTime"],
	description?: string | undefined,
	id: string,
	name: string,
	posts?: Array<GraphQLTypes["posts"]> | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	received_reviews?: Array<GraphQLTypes["reviews"]> | undefined,
	sent_reviews?: Array<GraphQLTypes["reviews"]> | undefined,
	tenant_form_submissions?: Array<GraphQLTypes["tenant_form_submissions"]> | undefined,
	type: GraphQLTypes["profile_type"],
	updated_at: GraphQLTypes["DateTime"],
	user: GraphQLTypes["users"],
	user_id: string
};
	["profilesCreateManyUserInput"]: {
		bio?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name: string,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	type: GraphQLTypes["profile_type"],
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["profilesCreateManyUserInputEnvelope"]: {
		data: Array<GraphQLTypes["profilesCreateManyUserInput"]>,
	skipDuplicates?: boolean | undefined
};
	["profilesCreateNestedManyWithoutUserInput"]: {
		connect?: Array<GraphQLTypes["profilesWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<GraphQLTypes["profilesCreateOrConnectWithoutUserInput"]> | undefined,
	create?: Array<GraphQLTypes["profilesCreateWithoutUserInput"]> | undefined,
	createMany?: GraphQLTypes["profilesCreateManyUserInputEnvelope"] | undefined
};
	["profilesCreateNestedOneWithoutReceived_reviewsInput"]: {
		connect?: GraphQLTypes["profilesWhereUniqueInput"] | undefined,
	connectOrCreate?: GraphQLTypes["profilesCreateOrConnectWithoutReceived_reviewsInput"] | undefined,
	create?: GraphQLTypes["profilesCreateWithoutReceived_reviewsInput"] | undefined
};
	["profilesCreateNestedOneWithoutSent_reviewsInput"]: {
		connect?: GraphQLTypes["profilesWhereUniqueInput"] | undefined,
	connectOrCreate?: GraphQLTypes["profilesCreateOrConnectWithoutSent_reviewsInput"] | undefined,
	create?: GraphQLTypes["profilesCreateWithoutSent_reviewsInput"] | undefined
};
	["profilesCreateOrConnectWithoutReceived_reviewsInput"]: {
		create: GraphQLTypes["profilesCreateWithoutReceived_reviewsInput"],
	where: GraphQLTypes["profilesWhereUniqueInput"]
};
	["profilesCreateOrConnectWithoutSent_reviewsInput"]: {
		create: GraphQLTypes["profilesCreateWithoutSent_reviewsInput"],
	where: GraphQLTypes["profilesWhereUniqueInput"]
};
	["profilesCreateOrConnectWithoutUserInput"]: {
		create: GraphQLTypes["profilesCreateWithoutUserInput"],
	where: GraphQLTypes["profilesWhereUniqueInput"]
};
	["profilesCreateWithoutReceived_reviewsInput"]: {
		bio?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name: string,
	posts?: GraphQLTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	sent_reviews?: GraphQLTypes["reviewsCreateNestedManyWithoutSent_by_profileInput"] | undefined,
	tenant_form_submissions?: GraphQLTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined,
	type: GraphQLTypes["profile_type"],
	updated_at?: GraphQLTypes["DateTime"] | undefined,
	user: GraphQLTypes["usersCreateNestedOneWithoutProfilesInput"]
};
	["profilesCreateWithoutSent_reviewsInput"]: {
		bio?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name: string,
	posts?: GraphQLTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	received_reviews?: GraphQLTypes["reviewsCreateNestedManyWithoutReceived_by_profileInput"] | undefined,
	tenant_form_submissions?: GraphQLTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined,
	type: GraphQLTypes["profile_type"],
	updated_at?: GraphQLTypes["DateTime"] | undefined,
	user: GraphQLTypes["usersCreateNestedOneWithoutProfilesInput"]
};
	["profilesCreateWithoutUserInput"]: {
		bio?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	description?: string | undefined,
	id?: string | undefined,
	name: string,
	posts?: GraphQLTypes["postsCreateNestedManyWithoutProfilesInput"] | undefined,
	property_city?: string | undefined,
	property_house_number?: string | undefined,
	property_postcode?: string | undefined,
	property_state?: string | undefined,
	property_street_address?: string | undefined,
	received_reviews?: GraphQLTypes["reviewsCreateNestedManyWithoutReceived_by_profileInput"] | undefined,
	sent_reviews?: GraphQLTypes["reviewsCreateNestedManyWithoutSent_by_profileInput"] | undefined,
	tenant_form_submissions?: GraphQLTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"] | undefined,
	type: GraphQLTypes["profile_type"],
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["profilesOrderByRelationAggregateInput"]: {
		_count?: GraphQLTypes["SortOrder"] | undefined
};
	["profilesOrderByWithRelationInput"]: {
		bio?: GraphQLTypes["SortOrderInput"] | undefined,
	created_at?: GraphQLTypes["SortOrder"] | undefined,
	description?: GraphQLTypes["SortOrderInput"] | undefined,
	id?: GraphQLTypes["SortOrder"] | undefined,
	name?: GraphQLTypes["SortOrder"] | undefined,
	posts?: GraphQLTypes["postsOrderByRelationAggregateInput"] | undefined,
	property_city?: GraphQLTypes["SortOrderInput"] | undefined,
	property_house_number?: GraphQLTypes["SortOrderInput"] | undefined,
	property_postcode?: GraphQLTypes["SortOrderInput"] | undefined,
	property_state?: GraphQLTypes["SortOrderInput"] | undefined,
	property_street_address?: GraphQLTypes["SortOrderInput"] | undefined,
	received_reviews?: GraphQLTypes["reviewsOrderByRelationAggregateInput"] | undefined,
	sent_reviews?: GraphQLTypes["reviewsOrderByRelationAggregateInput"] | undefined,
	tenant_form_submissions?: GraphQLTypes["tenant_form_submissionsOrderByRelationAggregateInput"] | undefined,
	type?: GraphQLTypes["SortOrder"] | undefined,
	updated_at?: GraphQLTypes["SortOrder"] | undefined,
	user?: GraphQLTypes["usersOrderByWithRelationInput"] | undefined,
	user_id?: GraphQLTypes["SortOrder"] | undefined
};
	["profilesUser_idTypeCompoundUniqueInput"]: {
		type: GraphQLTypes["profile_type"],
	user_id: string
};
	["profilesWhereInput"]: {
		AND?: Array<GraphQLTypes["profilesWhereInput"]> | undefined,
	NOT?: Array<GraphQLTypes["profilesWhereInput"]> | undefined,
	OR?: Array<GraphQLTypes["profilesWhereInput"]> | undefined,
	bio?: GraphQLTypes["StringNullableFilter"] | undefined,
	created_at?: GraphQLTypes["DateTimeFilter"] | undefined,
	description?: GraphQLTypes["StringNullableFilter"] | undefined,
	id?: GraphQLTypes["StringFilter"] | undefined,
	name?: GraphQLTypes["StringFilter"] | undefined,
	posts?: GraphQLTypes["PostsListRelationFilter"] | undefined,
	property_city?: GraphQLTypes["StringNullableFilter"] | undefined,
	property_house_number?: GraphQLTypes["StringNullableFilter"] | undefined,
	property_postcode?: GraphQLTypes["StringNullableFilter"] | undefined,
	property_state?: GraphQLTypes["StringNullableFilter"] | undefined,
	property_street_address?: GraphQLTypes["StringNullableFilter"] | undefined,
	received_reviews?: GraphQLTypes["ReviewsListRelationFilter"] | undefined,
	sent_reviews?: GraphQLTypes["ReviewsListRelationFilter"] | undefined,
	tenant_form_submissions?: GraphQLTypes["Tenant_form_submissionsListRelationFilter"] | undefined,
	type?: GraphQLTypes["Enumprofile_typeFilter"] | undefined,
	updated_at?: GraphQLTypes["DateTimeFilter"] | undefined,
	user?: GraphQLTypes["UsersRelationFilter"] | undefined,
	user_id?: GraphQLTypes["StringFilter"] | undefined
};
	["profilesWhereUniqueInput"]: {
		id?: string | undefined,
	user_id_type?: GraphQLTypes["profilesUser_idTypeCompoundUniqueInput"] | undefined
};
	["review_category"]: review_category;
	["reviews"]: {
	__typename: "reviews",
	category: GraphQLTypes["review_category"],
	comment?: string | undefined,
	created_at: GraphQLTypes["DateTime"],
	id: string,
	received_by_profile: GraphQLTypes["profiles"],
	received_by_profile_id: string,
	sent_by_profile: GraphQLTypes["profiles"],
	sent_by_profile_id: string,
	stars?: number | undefined,
	updated_at: GraphQLTypes["DateTime"]
};
	["reviewsCreateManyReceived_by_profileInput"]: {
		category: GraphQLTypes["review_category"],
	comment?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	sent_by_profile_id: string,
	stars?: number | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["reviewsCreateManyReceived_by_profileInputEnvelope"]: {
		data: Array<GraphQLTypes["reviewsCreateManyReceived_by_profileInput"]>,
	skipDuplicates?: boolean | undefined
};
	["reviewsCreateManySent_by_profileInput"]: {
		category: GraphQLTypes["review_category"],
	comment?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	received_by_profile_id: string,
	stars?: number | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["reviewsCreateManySent_by_profileInputEnvelope"]: {
		data: Array<GraphQLTypes["reviewsCreateManySent_by_profileInput"]>,
	skipDuplicates?: boolean | undefined
};
	["reviewsCreateNestedManyWithoutReceived_by_profileInput"]: {
		connect?: Array<GraphQLTypes["reviewsWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<GraphQLTypes["reviewsCreateOrConnectWithoutReceived_by_profileInput"]> | undefined,
	create?: Array<GraphQLTypes["reviewsCreateWithoutReceived_by_profileInput"]> | undefined,
	createMany?: GraphQLTypes["reviewsCreateManyReceived_by_profileInputEnvelope"] | undefined
};
	["reviewsCreateNestedManyWithoutSent_by_profileInput"]: {
		connect?: Array<GraphQLTypes["reviewsWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<GraphQLTypes["reviewsCreateOrConnectWithoutSent_by_profileInput"]> | undefined,
	create?: Array<GraphQLTypes["reviewsCreateWithoutSent_by_profileInput"]> | undefined,
	createMany?: GraphQLTypes["reviewsCreateManySent_by_profileInputEnvelope"] | undefined
};
	["reviewsCreateOrConnectWithoutReceived_by_profileInput"]: {
		create: GraphQLTypes["reviewsCreateWithoutReceived_by_profileInput"],
	where: GraphQLTypes["reviewsWhereUniqueInput"]
};
	["reviewsCreateOrConnectWithoutSent_by_profileInput"]: {
		create: GraphQLTypes["reviewsCreateWithoutSent_by_profileInput"],
	where: GraphQLTypes["reviewsWhereUniqueInput"]
};
	["reviewsCreateWithoutReceived_by_profileInput"]: {
		category: GraphQLTypes["review_category"],
	comment?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	sent_by_profile: GraphQLTypes["profilesCreateNestedOneWithoutSent_reviewsInput"],
	stars?: number | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["reviewsCreateWithoutSent_by_profileInput"]: {
		category: GraphQLTypes["review_category"],
	comment?: string | undefined,
	created_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	received_by_profile: GraphQLTypes["profilesCreateNestedOneWithoutReceived_reviewsInput"],
	stars?: number | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["reviewsOrderByRelationAggregateInput"]: {
		_count?: GraphQLTypes["SortOrder"] | undefined
};
	["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"]: {
		category: GraphQLTypes["review_category"],
	received_by_profile_id: string,
	sent_by_profile_id: string
};
	["reviewsWhereInput"]: {
		AND?: Array<GraphQLTypes["reviewsWhereInput"]> | undefined,
	NOT?: Array<GraphQLTypes["reviewsWhereInput"]> | undefined,
	OR?: Array<GraphQLTypes["reviewsWhereInput"]> | undefined,
	category?: GraphQLTypes["Enumreview_categoryFilter"] | undefined,
	comment?: GraphQLTypes["StringNullableFilter"] | undefined,
	created_at?: GraphQLTypes["DateTimeFilter"] | undefined,
	id?: GraphQLTypes["StringFilter"] | undefined,
	received_by_profile?: GraphQLTypes["ProfilesRelationFilter"] | undefined,
	received_by_profile_id?: GraphQLTypes["StringFilter"] | undefined,
	sent_by_profile?: GraphQLTypes["ProfilesRelationFilter"] | undefined,
	sent_by_profile_id?: GraphQLTypes["StringFilter"] | undefined,
	stars?: GraphQLTypes["IntNullableFilter"] | undefined,
	updated_at?: GraphQLTypes["DateTimeFilter"] | undefined
};
	["reviewsWhereUniqueInput"]: {
		id?: string | undefined,
	sent_by_profile_id_received_by_profile_id_category?: GraphQLTypes["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"] | undefined
};
	["reviews_scaler_type"]: {
	__typename: "reviews_scaler_type",
	category: GraphQLTypes["review_category"],
	comment?: string | undefined,
	created_at: GraphQLTypes["DateTime"],
	id: string,
	received_by_profile_id: string,
	sent_by_profile_id: string,
	stars?: number | undefined,
	updated_at: GraphQLTypes["DateTime"]
};
	["tenant_form_submissions"]: {
	__typename: "tenant_form_submissions",
	created_at: GraphQLTypes["DateTime"],
	duration_in_months: number,
	email: string,
	from_profile_id: string,
	id: string,
	name: string,
	phone: string,
	profiles: GraphQLTypes["profiles"],
	surname: string,
	updated_at: GraphQLTypes["DateTime"]
};
	["tenant_form_submissionsCreateManyProfilesInput"]: {
		created_at?: GraphQLTypes["DateTime"] | undefined,
	duration_in_months: number,
	email: string,
	id?: string | undefined,
	name: string,
	phone: string,
	surname: string,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["tenant_form_submissionsCreateManyProfilesInputEnvelope"]: {
		data: Array<GraphQLTypes["tenant_form_submissionsCreateManyProfilesInput"]>,
	skipDuplicates?: boolean | undefined
};
	["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"]: {
		connect?: Array<GraphQLTypes["tenant_form_submissionsWhereUniqueInput"]> | undefined,
	connectOrCreate?: Array<GraphQLTypes["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"]> | undefined,
	create?: Array<GraphQLTypes["tenant_form_submissionsCreateWithoutProfilesInput"]> | undefined,
	createMany?: GraphQLTypes["tenant_form_submissionsCreateManyProfilesInputEnvelope"] | undefined
};
	["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"]: {
		create: GraphQLTypes["tenant_form_submissionsCreateWithoutProfilesInput"],
	where: GraphQLTypes["tenant_form_submissionsWhereUniqueInput"]
};
	["tenant_form_submissionsCreateWithoutProfilesInput"]: {
		created_at?: GraphQLTypes["DateTime"] | undefined,
	duration_in_months: number,
	email: string,
	id?: string | undefined,
	name: string,
	phone: string,
	surname: string,
	updated_at?: GraphQLTypes["DateTime"] | undefined
};
	["tenant_form_submissionsOrderByRelationAggregateInput"]: {
		_count?: GraphQLTypes["SortOrder"] | undefined
};
	["tenant_form_submissionsWhereInput"]: {
		AND?: Array<GraphQLTypes["tenant_form_submissionsWhereInput"]> | undefined,
	NOT?: Array<GraphQLTypes["tenant_form_submissionsWhereInput"]> | undefined,
	OR?: Array<GraphQLTypes["tenant_form_submissionsWhereInput"]> | undefined,
	created_at?: GraphQLTypes["DateTimeFilter"] | undefined,
	duration_in_months?: GraphQLTypes["IntFilter"] | undefined,
	email?: GraphQLTypes["StringFilter"] | undefined,
	from_profile_id?: GraphQLTypes["StringFilter"] | undefined,
	id?: GraphQLTypes["StringFilter"] | undefined,
	name?: GraphQLTypes["StringFilter"] | undefined,
	phone?: GraphQLTypes["StringFilter"] | undefined,
	profiles?: GraphQLTypes["ProfilesRelationFilter"] | undefined,
	surname?: GraphQLTypes["StringFilter"] | undefined,
	updated_at?: GraphQLTypes["DateTimeFilter"] | undefined
};
	["tenant_form_submissionsWhereUniqueInput"]: {
		id?: string | undefined
};
	["users"]: {
	__typename: "users",
	_count: GraphQLTypes["UsersCount"],
	created_at: GraphQLTypes["DateTime"],
	date_of_birth: number,
	email: string,
	email_verified_at?: GraphQLTypes["DateTime"] | undefined,
	id: string,
	password: string,
	permissions?: Array<GraphQLTypes["permission"]> | undefined,
	profiles?: Array<GraphQLTypes["profiles"]> | undefined,
	updated_at: GraphQLTypes["DateTime"],
	username: string
};
	["usersCreateInput"]: {
		created_at?: GraphQLTypes["DateTime"] | undefined,
	date_of_birth: number,
	email: string,
	email_verified_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	password: string,
	permissions?: GraphQLTypes["usersCreatepermissionsInput"] | undefined,
	profiles?: GraphQLTypes["profilesCreateNestedManyWithoutUserInput"] | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined,
	username: string
};
	["usersCreateNestedOneWithoutProfilesInput"]: {
		connect?: GraphQLTypes["usersWhereUniqueInput"] | undefined,
	connectOrCreate?: GraphQLTypes["usersCreateOrConnectWithoutProfilesInput"] | undefined,
	create?: GraphQLTypes["usersCreateWithoutProfilesInput"] | undefined
};
	["usersCreateOrConnectWithoutProfilesInput"]: {
		create: GraphQLTypes["usersCreateWithoutProfilesInput"],
	where: GraphQLTypes["usersWhereUniqueInput"]
};
	["usersCreateWithoutProfilesInput"]: {
		created_at?: GraphQLTypes["DateTime"] | undefined,
	date_of_birth: number,
	email: string,
	email_verified_at?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	password: string,
	permissions?: GraphQLTypes["usersCreatepermissionsInput"] | undefined,
	updated_at?: GraphQLTypes["DateTime"] | undefined,
	username: string
};
	["usersCreatepermissionsInput"]: {
		set: Array<GraphQLTypes["permission"]>
};
	["usersOrderByWithRelationInput"]: {
		created_at?: GraphQLTypes["SortOrder"] | undefined,
	date_of_birth?: GraphQLTypes["SortOrder"] | undefined,
	email?: GraphQLTypes["SortOrder"] | undefined,
	email_verified_at?: GraphQLTypes["SortOrderInput"] | undefined,
	id?: GraphQLTypes["SortOrder"] | undefined,
	password?: GraphQLTypes["SortOrder"] | undefined,
	permissions?: GraphQLTypes["SortOrder"] | undefined,
	profiles?: GraphQLTypes["profilesOrderByRelationAggregateInput"] | undefined,
	updated_at?: GraphQLTypes["SortOrder"] | undefined,
	username?: GraphQLTypes["SortOrder"] | undefined
};
	["usersWhereInput"]: {
		AND?: Array<GraphQLTypes["usersWhereInput"]> | undefined,
	NOT?: Array<GraphQLTypes["usersWhereInput"]> | undefined,
	OR?: Array<GraphQLTypes["usersWhereInput"]> | undefined,
	created_at?: GraphQLTypes["DateTimeFilter"] | undefined,
	date_of_birth?: GraphQLTypes["IntFilter"] | undefined,
	email?: GraphQLTypes["StringFilter"] | undefined,
	email_verified_at?: GraphQLTypes["DateTimeNullableFilter"] | undefined,
	id?: GraphQLTypes["StringFilter"] | undefined,
	password?: GraphQLTypes["StringFilter"] | undefined,
	permissions?: GraphQLTypes["EnumpermissionNullableListFilter"] | undefined,
	profiles?: GraphQLTypes["ProfilesListRelationFilter"] | undefined,
	updated_at?: GraphQLTypes["DateTimeFilter"] | undefined,
	username?: GraphQLTypes["StringFilter"] | undefined
};
	["usersWhereUniqueInput"]: {
		email?: string | undefined,
	id?: string | undefined,
	username?: string | undefined
}
    }
export const enum NullsOrder {
	first = "first",
	last = "last"
}
export const enum ProfilesScalarFieldEnum {
	bio = "bio",
	created_at = "created_at",
	description = "description",
	id = "id",
	name = "name",
	property_city = "property_city",
	property_house_number = "property_house_number",
	property_postcode = "property_postcode",
	property_state = "property_state",
	property_street_address = "property_street_address",
	type = "type",
	updated_at = "updated_at",
	user_id = "user_id"
}
export const enum QueryMode {
	default = "default",
	insensitive = "insensitive"
}
export const enum SortOrder {
	asc = "asc",
	desc = "desc"
}
export const enum UsersScalarFieldEnum {
	created_at = "created_at",
	date_of_birth = "date_of_birth",
	email = "email",
	email_verified_at = "email_verified_at",
	id = "id",
	password = "password",
	permissions = "permissions",
	updated_at = "updated_at",
	username = "username"
}
export const enum permission {
	CREATE_USER = "CREATE_USER",
	MODIFY_USER = "MODIFY_USER"
}
export const enum profile_type {
	LANDLORD = "LANDLORD",
	TENANT = "TENANT"
}
export const enum review_category {
	CLEANLINESS = "CLEANLINESS",
	COMMUNICATION = "COMMUNICATION",
	HANDLING_DEPOSITS = "HANDLING_DEPOSITS",
	MAINTENANCE = "MAINTENANCE",
	MOVING_IN = "MOVING_IN",
	MOVING_OUT = "MOVING_OUT",
	SECURITY = "SECURITY",
	SPEED_OF_REPAIRD = "SPEED_OF_REPAIRD",
	STATE_OF_PROPERTY = "STATE_OF_PROPERTY",
	VALUE_FOR_MONEY = "VALUE_FOR_MONEY"
}

type ZEUS_VARIABLES = {
	["CreateProfileInput"]: ValueTypes["CreateProfileInput"];
	["CreateReviewDto"]: ValueTypes["CreateReviewDto"];
	["CreateTenantFormDto"]: ValueTypes["CreateTenantFormDto"];
	["DateTime"]: ValueTypes["DateTime"];
	["DateTimeFilter"]: ValueTypes["DateTimeFilter"];
	["DateTimeNullableFilter"]: ValueTypes["DateTimeNullableFilter"];
	["EnumpermissionNullableListFilter"]: ValueTypes["EnumpermissionNullableListFilter"];
	["Enumprofile_typeFilter"]: ValueTypes["Enumprofile_typeFilter"];
	["Enumreview_categoryFilter"]: ValueTypes["Enumreview_categoryFilter"];
	["IntFilter"]: ValueTypes["IntFilter"];
	["IntNullableFilter"]: ValueTypes["IntNullableFilter"];
	["LoginDto"]: ValueTypes["LoginDto"];
	["NestedDateTimeFilter"]: ValueTypes["NestedDateTimeFilter"];
	["NestedDateTimeNullableFilter"]: ValueTypes["NestedDateTimeNullableFilter"];
	["NestedEnumprofile_typeFilter"]: ValueTypes["NestedEnumprofile_typeFilter"];
	["NestedEnumreview_categoryFilter"]: ValueTypes["NestedEnumreview_categoryFilter"];
	["NestedIntFilter"]: ValueTypes["NestedIntFilter"];
	["NestedIntNullableFilter"]: ValueTypes["NestedIntNullableFilter"];
	["NestedStringFilter"]: ValueTypes["NestedStringFilter"];
	["NestedStringNullableFilter"]: ValueTypes["NestedStringNullableFilter"];
	["NullsOrder"]: ValueTypes["NullsOrder"];
	["PostsListRelationFilter"]: ValueTypes["PostsListRelationFilter"];
	["ProfilesListRelationFilter"]: ValueTypes["ProfilesListRelationFilter"];
	["ProfilesRelationFilter"]: ValueTypes["ProfilesRelationFilter"];
	["ProfilesScalarFieldEnum"]: ValueTypes["ProfilesScalarFieldEnum"];
	["QueryMode"]: ValueTypes["QueryMode"];
	["ReviewsListRelationFilter"]: ValueTypes["ReviewsListRelationFilter"];
	["SignUpDto"]: ValueTypes["SignUpDto"];
	["SortOrder"]: ValueTypes["SortOrder"];
	["SortOrderInput"]: ValueTypes["SortOrderInput"];
	["StringFilter"]: ValueTypes["StringFilter"];
	["StringNullableFilter"]: ValueTypes["StringNullableFilter"];
	["StringNullableListFilter"]: ValueTypes["StringNullableListFilter"];
	["Tenant_form_submissionsListRelationFilter"]: ValueTypes["Tenant_form_submissionsListRelationFilter"];
	["UsersRelationFilter"]: ValueTypes["UsersRelationFilter"];
	["UsersScalarFieldEnum"]: ValueTypes["UsersScalarFieldEnum"];
	["permission"]: ValueTypes["permission"];
	["postsCreateManyProfilesInput"]: ValueTypes["postsCreateManyProfilesInput"];
	["postsCreateManyProfilesInputEnvelope"]: ValueTypes["postsCreateManyProfilesInputEnvelope"];
	["postsCreateNestedManyWithoutProfilesInput"]: ValueTypes["postsCreateNestedManyWithoutProfilesInput"];
	["postsCreateOrConnectWithoutProfilesInput"]: ValueTypes["postsCreateOrConnectWithoutProfilesInput"];
	["postsCreateWithoutProfilesInput"]: ValueTypes["postsCreateWithoutProfilesInput"];
	["postsCreatemediaInput"]: ValueTypes["postsCreatemediaInput"];
	["postsOrderByRelationAggregateInput"]: ValueTypes["postsOrderByRelationAggregateInput"];
	["postsWhereInput"]: ValueTypes["postsWhereInput"];
	["postsWhereUniqueInput"]: ValueTypes["postsWhereUniqueInput"];
	["profile_type"]: ValueTypes["profile_type"];
	["profilesCreateManyUserInput"]: ValueTypes["profilesCreateManyUserInput"];
	["profilesCreateManyUserInputEnvelope"]: ValueTypes["profilesCreateManyUserInputEnvelope"];
	["profilesCreateNestedManyWithoutUserInput"]: ValueTypes["profilesCreateNestedManyWithoutUserInput"];
	["profilesCreateNestedOneWithoutReceived_reviewsInput"]: ValueTypes["profilesCreateNestedOneWithoutReceived_reviewsInput"];
	["profilesCreateNestedOneWithoutSent_reviewsInput"]: ValueTypes["profilesCreateNestedOneWithoutSent_reviewsInput"];
	["profilesCreateOrConnectWithoutReceived_reviewsInput"]: ValueTypes["profilesCreateOrConnectWithoutReceived_reviewsInput"];
	["profilesCreateOrConnectWithoutSent_reviewsInput"]: ValueTypes["profilesCreateOrConnectWithoutSent_reviewsInput"];
	["profilesCreateOrConnectWithoutUserInput"]: ValueTypes["profilesCreateOrConnectWithoutUserInput"];
	["profilesCreateWithoutReceived_reviewsInput"]: ValueTypes["profilesCreateWithoutReceived_reviewsInput"];
	["profilesCreateWithoutSent_reviewsInput"]: ValueTypes["profilesCreateWithoutSent_reviewsInput"];
	["profilesCreateWithoutUserInput"]: ValueTypes["profilesCreateWithoutUserInput"];
	["profilesOrderByRelationAggregateInput"]: ValueTypes["profilesOrderByRelationAggregateInput"];
	["profilesOrderByWithRelationInput"]: ValueTypes["profilesOrderByWithRelationInput"];
	["profilesUser_idTypeCompoundUniqueInput"]: ValueTypes["profilesUser_idTypeCompoundUniqueInput"];
	["profilesWhereInput"]: ValueTypes["profilesWhereInput"];
	["profilesWhereUniqueInput"]: ValueTypes["profilesWhereUniqueInput"];
	["review_category"]: ValueTypes["review_category"];
	["reviewsCreateManyReceived_by_profileInput"]: ValueTypes["reviewsCreateManyReceived_by_profileInput"];
	["reviewsCreateManyReceived_by_profileInputEnvelope"]: ValueTypes["reviewsCreateManyReceived_by_profileInputEnvelope"];
	["reviewsCreateManySent_by_profileInput"]: ValueTypes["reviewsCreateManySent_by_profileInput"];
	["reviewsCreateManySent_by_profileInputEnvelope"]: ValueTypes["reviewsCreateManySent_by_profileInputEnvelope"];
	["reviewsCreateNestedManyWithoutReceived_by_profileInput"]: ValueTypes["reviewsCreateNestedManyWithoutReceived_by_profileInput"];
	["reviewsCreateNestedManyWithoutSent_by_profileInput"]: ValueTypes["reviewsCreateNestedManyWithoutSent_by_profileInput"];
	["reviewsCreateOrConnectWithoutReceived_by_profileInput"]: ValueTypes["reviewsCreateOrConnectWithoutReceived_by_profileInput"];
	["reviewsCreateOrConnectWithoutSent_by_profileInput"]: ValueTypes["reviewsCreateOrConnectWithoutSent_by_profileInput"];
	["reviewsCreateWithoutReceived_by_profileInput"]: ValueTypes["reviewsCreateWithoutReceived_by_profileInput"];
	["reviewsCreateWithoutSent_by_profileInput"]: ValueTypes["reviewsCreateWithoutSent_by_profileInput"];
	["reviewsOrderByRelationAggregateInput"]: ValueTypes["reviewsOrderByRelationAggregateInput"];
	["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"]: ValueTypes["reviewsSent_by_profile_idReceived_by_profile_idCategoryCompoundUniqueInput"];
	["reviewsWhereInput"]: ValueTypes["reviewsWhereInput"];
	["reviewsWhereUniqueInput"]: ValueTypes["reviewsWhereUniqueInput"];
	["tenant_form_submissionsCreateManyProfilesInput"]: ValueTypes["tenant_form_submissionsCreateManyProfilesInput"];
	["tenant_form_submissionsCreateManyProfilesInputEnvelope"]: ValueTypes["tenant_form_submissionsCreateManyProfilesInputEnvelope"];
	["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"]: ValueTypes["tenant_form_submissionsCreateNestedManyWithoutProfilesInput"];
	["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"]: ValueTypes["tenant_form_submissionsCreateOrConnectWithoutProfilesInput"];
	["tenant_form_submissionsCreateWithoutProfilesInput"]: ValueTypes["tenant_form_submissionsCreateWithoutProfilesInput"];
	["tenant_form_submissionsOrderByRelationAggregateInput"]: ValueTypes["tenant_form_submissionsOrderByRelationAggregateInput"];
	["tenant_form_submissionsWhereInput"]: ValueTypes["tenant_form_submissionsWhereInput"];
	["tenant_form_submissionsWhereUniqueInput"]: ValueTypes["tenant_form_submissionsWhereUniqueInput"];
	["usersCreateInput"]: ValueTypes["usersCreateInput"];
	["usersCreateNestedOneWithoutProfilesInput"]: ValueTypes["usersCreateNestedOneWithoutProfilesInput"];
	["usersCreateOrConnectWithoutProfilesInput"]: ValueTypes["usersCreateOrConnectWithoutProfilesInput"];
	["usersCreateWithoutProfilesInput"]: ValueTypes["usersCreateWithoutProfilesInput"];
	["usersCreatepermissionsInput"]: ValueTypes["usersCreatepermissionsInput"];
	["usersOrderByWithRelationInput"]: ValueTypes["usersOrderByWithRelationInput"];
	["usersWhereInput"]: ValueTypes["usersWhereInput"];
	["usersWhereUniqueInput"]: ValueTypes["usersWhereUniqueInput"];
}