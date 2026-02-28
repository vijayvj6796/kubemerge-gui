export namespace main {
	
	export class ClusterInfo {
	    reachable: boolean;
	    version: string;
	    authenticated: boolean;
	    clusterName: string;
	    serverUrl: string;
	    errorMessage: string;
	
	    static createFrom(source: any = {}) {
	        return new ClusterInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.reachable = source["reachable"];
	        this.version = source["version"];
	        this.authenticated = source["authenticated"];
	        this.clusterName = source["clusterName"];
	        this.serverUrl = source["serverUrl"];
	        this.errorMessage = source["errorMessage"];
	    }
	}
	export class ContextDetails {
	    contextName: string;
	    clusterName: string;
	    clusterUrl: string;
	    userName: string;
	    namespace: string;
	    // Go type: time
	    certExpiration: any;
	    certExpiresInDays: number;
	    hasCertExpiration: boolean;
	    certExpirationWarning: string;
	
	    static createFrom(source: any = {}) {
	        return new ContextDetails(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contextName = source["contextName"];
	        this.clusterName = source["clusterName"];
	        this.clusterUrl = source["clusterUrl"];
	        this.userName = source["userName"];
	        this.namespace = source["namespace"];
	        this.certExpiration = this.convertValues(source["certExpiration"], null);
	        this.certExpiresInDays = source["certExpiresInDays"];
	        this.hasCertExpiration = source["hasCertExpiration"];
	        this.certExpirationWarning = source["certExpirationWarning"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ContextInfo {
	    name: string;
	    isCurrent: boolean;
	    cluster: string;
	    namespace: string;
	
	    static createFrom(source: any = {}) {
	        return new ContextInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isCurrent = source["isCurrent"];
	        this.cluster = source["cluster"];
	        this.namespace = source["namespace"];
	    }
	}
	export class MergeResult {
	    targetConfigPath: string;
	    backupPath: string;
	    addedClusters: string[];
	    addedContexts: string[];
	    addedUsers: string[];
	    allContexts: string[];
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new MergeResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.targetConfigPath = source["targetConfigPath"];
	        this.backupPath = source["backupPath"];
	        this.addedClusters = source["addedClusters"];
	        this.addedContexts = source["addedContexts"];
	        this.addedUsers = source["addedUsers"];
	        this.allContexts = source["allContexts"];
	        this.message = source["message"];
	    }
	}
	export class TargetSelection {
	    kind: string;
	    distro: string;
	    linuxUser: string;
	
	    static createFrom(source: any = {}) {
	        return new TargetSelection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.distro = source["distro"];
	        this.linuxUser = source["linuxUser"];
	    }
	}

}

