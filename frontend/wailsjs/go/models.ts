export namespace main {
	
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

