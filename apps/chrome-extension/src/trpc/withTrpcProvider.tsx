import type { ComponentType } from "react";

import { TRPCReactProvider } from "./react";

export function withTrpcProvider<T extends object>(
  Component: ComponentType<T>
): ComponentType<T> {
  const WithTrpcProvider = (props: T) => {
    return (
      <TRPCReactProvider>
        <Component {...props} />
      </TRPCReactProvider>
    );
  };

  WithTrpcProvider.displayName = `withTrpcProvider(${
    Component.displayName || Component.name || "Component"
  })`;

  return WithTrpcProvider;
}

export default withTrpcProvider;
