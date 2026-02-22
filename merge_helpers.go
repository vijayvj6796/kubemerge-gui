package main

import (
	"encoding/json"
	"fmt"

	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

func deepEqual(a any, b any) bool {
	aj, _ := json.Marshal(a)
	bj, _ := json.Marshal(b)
	return string(aj) == string(bj)
}

func uniqueName(base string, suffix int) string {
	return fmt.Sprintf("%s__import_%d", base, suffix)
}

func mergeCluster(dst *clientcmdapi.Config, name string, c *clientcmdapi.Cluster) (finalName string, added bool, err error) {
	if existing, ok := dst.Clusters[name]; ok {
		if deepEqual(existing, c) {
			return name, false, nil
		}
		// conflict -> generate unique name
		for i := 1; i < 1000; i++ {
			n := uniqueName(name, i)
			if _, exists := dst.Clusters[n]; !exists {
				dst.Clusters[n] = c
				return n, true, nil
			}
		}
		return "", false, fmt.Errorf("too many conflicts for cluster name %q", name)
	}
	dst.Clusters[name] = c
	return name, true, nil
}

func mergeUser(dst *clientcmdapi.Config, name string, u *clientcmdapi.AuthInfo) (finalName string, added bool, err error) {
	if existing, ok := dst.AuthInfos[name]; ok {
		if deepEqual(existing, u) {
			return name, false, nil
		}
		for i := 1; i < 1000; i++ {
			n := uniqueName(name, i)
			if _, exists := dst.AuthInfos[n]; !exists {
				dst.AuthInfos[n] = u
				return n, true, nil
			}
		}
		return "", false, fmt.Errorf("too many conflicts for user name %q", name)
	}
	dst.AuthInfos[name] = u
	return name, true, nil
}

func mergeContext(dst *clientcmdapi.Config, name string, cx *clientcmdapi.Context) (finalName string, added bool, err error) {
	if existing, ok := dst.Contexts[name]; ok {
		if deepEqual(existing, cx) {
			return name, false, nil
		}
		for i := 1; i < 1000; i++ {
			n := uniqueName(name, i)
			if _, exists := dst.Contexts[n]; !exists {
				dst.Contexts[n] = cx
				return n, true, nil
			}
		}
		return "", false, fmt.Errorf("too many conflicts for context name %q", name)
	}
	dst.Contexts[name] = cx
	return name, true, nil
}
