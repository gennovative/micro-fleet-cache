/// <reference path="./global.d.ts" />

declare module 'back-lib-common-web/dist/app/RestControllerBase' {
	/// <reference types="express" />
	import * as express from 'express';
	import TrailsApp = require('trails');
	import TrailsController = require('trails-controller');
	export abstract class RestControllerBase extends TrailsController {
	    constructor(trailsApp: TrailsApp);
	    /*** SUCCESS ***/
	    /**
	     * Responds as Accepted with status code 202 and optional data.
	     * @param res Express response object.
	     * @param data Data to optionally return to client.
	     */
	    protected accepted(res: express.Response, data?: any): void;
	    /**
	     * Responds as Created with status code 201 and optional data.
	     * @param res Express response object.
	     * @param data Data to optionally return to client.
	     */
	    protected created(res: express.Response, data?: any): void;
	    /**
	     * Responds as OK with status code 200 and optional data.
	     * @param res Express response object.
	     * @param data Data to optionally return to client.
	     */
	    protected ok(res: express.Response, data?: any): void;
	    /*** CLIENT ERRORS ***/
	    /**
	     * Responds with error status code (default 400) and writes error to server log,
	     * then returned it to client.
	     * @param res Express response object.
	     * @param returnErr Error to dump to server log, and returned to client.
	     * @param statusCode HTTP status code. Must be 4xx. Default is 400.
	     * @param shouldLogErr Whether to write error to server log (eg: Illegal attempt to read/write resource...). Default to false.
	     */
	    protected clientError(res: express.Response, returnErr: any, statusCode?: number, shouldLogErr?: boolean): void;
	    /**
	     * Responds as Forbidden with status code 403 and optional error message.
	     * @param res Express response object.
	     * @param returnErr Data to optionally return to client.
	     */
	    protected forbidden(res: express.Response, returnErr?: any): void;
	    /**
	     * Responds as Not Found with status code 404 and optional error message.
	     * @param res Express response object.
	     * @param returnErr Data to optionally return to client.
	     */
	    protected notFound(res: express.Response, returnErr?: any): void;
	    /**
	     * Responds as Unauthorized with status code 401 and optional error message.
	     * @param res Express response object.
	     * @param returnErr Data to optionally return to client.
	     */
	    protected unauthorized(res: express.Response, returnErr?: any): void;
	    /**
	     * Responds error Precondition Failed with status code 412 and
	     * then returned error to client.
	     * @param res Express response object.
	     * @param returnErr Error to returned to client.
	     */
	    protected validationError(res: express.Response, returnErr: any): void;
	    /*** SERVER ERRORS ***/
	    /**
	     * Responds as Internal Error with status code 500 and
	     * writes error to server log. The error is not returned to client.
	     * @param res Express response object.
	     * @param logErr Error to dump to server log, but not returned to client.
	     */
	    protected internalError(res: express.Response, logErr: any): void;
	    /**
	     * Sends response to client.
	     * @param res Express response object.
	     * @param data Data to return to client.
	     * @param statusCode HTTP status code. Default is 200.
	     */
	    protected send(res: express.Response, data: any, statusCode: number): express.Response;
	}

}
declare module 'back-lib-common-web/dist/app/RestCRUDControllerBase' {
	/// <reference types="express" />
	import * as express from 'express';
	import TrailsApp = require('trails');
	import { ISoftDelRepository, ModelAutoMapper, JoiModelValidator } from 'back-lib-common-contracts';
	import { RestControllerBase } from 'back-lib-common-web/dist/app/RestControllerBase';
	export abstract class RestCRUDControllerBase<TModel extends IModelDTO> extends RestControllerBase {
	    protected _ClassDTO: {
	        new (): TModel;
	    };
	    protected _repo: ISoftDelRepository<TModel, any, any>;
	    /**
	     * Generates Trails route configs to put in file app/config/routes.js
	     * @param {string} controllerDepIdentifier Key to look up and resolve from dependency container.
	     * @param {boolean} isSoftDel Whether to add endpoints for `deleteSoft` and `recover`.
	     * @param {string} pathPrefix Path prefix with heading slash and without trailing slash. Eg: /api/v1
	     */
	    static createRouteConfigs(controllerDepIdentifier: string, isSoftDel: boolean, pathPrefix?: string): TrailsRouteConfigItem[];
	    constructor(trailsApp: TrailsApp, _ClassDTO?: {
	        new (): TModel;
	    }, _repo?: ISoftDelRepository<TModel, any, any>);
	    protected readonly validator: JoiModelValidator<TModel>;
	    protected readonly translator: ModelAutoMapper<TModel>;
	    countAll(req: express.Request, res: express.Response): Promise<void>;
	    create(req: express.Request, res: express.Response): Promise<void>;
	    deleteHard(req: express.Request, res: express.Response): Promise<void>;
	    deleteSoft(req: express.Request, res: express.Response): Promise<void>;
	    exists(req: express.Request, res: express.Response): Promise<void>;
	    findByPk(req: express.Request, res: express.Response): Promise<void>;
	    recover(req: express.Request, res: express.Response): Promise<void>;
	    page(req: express.Request, res: express.Response): Promise<void>;
	    patch(req: express.Request, res: express.Response): Promise<void>;
	    update(req: express.Request, res: express.Response): Promise<void>;
	}

}
declare module 'back-lib-common-web/dist/app/Types' {
	export class Types {
	    static readonly TRAILS_ADDON: string;
	    static readonly TRAILS_APP: string;
	    static readonly TRAILS_OPTS: string;
	}

}
declare module 'back-lib-common-web/dist/app/TrailsServerAddOn' {
	import TrailsApp = require('trails');
	import { IDependencyContainer } from 'back-lib-common-util';
	export class TrailsServerAddOn implements IServiceAddOn {
	    	    constructor(depContainer: IDependencyContainer, trailsOpts: TrailsApp.TrailsAppOts);
	    readonly server: TrailsApp;
	    /**
	     * @see IServiceAddOn.init
	     */
	    init(): Promise<void>;
	    /**
	     * @see IServiceAddOn.deadLetter
	     */
	    deadLetter(): Promise<void>;
	    /**
	     * @see IServiceAddOn.dispose
	     */
	    dispose(): Promise<void>;
	}

}
declare module 'back-lib-common-web' {
	export * from 'back-lib-common-web/dist/app/RestControllerBase';
	export * from 'back-lib-common-web/dist/app/RestCRUDControllerBase';
	export * from 'back-lib-common-web/dist/app/TrailsServerAddOn';
	export * from 'back-lib-common-web/dist/app/Types';

}
