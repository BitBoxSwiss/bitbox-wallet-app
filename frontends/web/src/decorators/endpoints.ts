import { Component, RenderableProps } from 'preact';

/**
 * Describes which endpoints should be loaded to which property names.
 * 
 * Example: `{ propertyName: 'path/to/endpoint' }`
 */
export interface Endpoints {
    readonly [key: string]: string;
}

/**
 * Allows to derive the endpoints based on existing properties.
 * 
 * Example: `props => 'subject/' + props.id + '/attribute`
 */
export type EndpointsFunction<Props> = (props: RenderableProps<Props>) => Endpoints;
