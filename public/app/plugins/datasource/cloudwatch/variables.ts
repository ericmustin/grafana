import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { CloudWatchDatasource } from './datasource';
import { VariableQuery, VariableQueryType } from './types';
import { migrateVariableQuery } from './migrations';
import { VariableQueryEditor } from './components/VariableQueryEditor/VariableQueryEditor';

export class CloudWatchVariableSupport extends CustomVariableSupport<CloudWatchDatasource, VariableQuery> {
  private readonly datasource: CloudWatchDatasource;

  constructor(datasource: CloudWatchDatasource) {
    super();
    this.datasource = datasource;
    this.query = this.query.bind(this);
  }

  editor = VariableQueryEditor;

  query(request: DataQueryRequest<VariableQuery>): Observable<DataQueryResponse> {
    const queryObj = migrateVariableQuery(request.targets[0]);
    return from(this.execute(queryObj)).pipe(map((data) => ({ data })));
  }

  async execute(query: VariableQuery) {
    try {
      switch (query.queryType) {
        case VariableQueryType.Regions:
          return this.handleRegionsQuery();
        case VariableQueryType.Namespaces:
          return this.handleNamespacesQuery();
        case VariableQueryType.Metrics:
          return this.handleMetricsQuery(query);
        case VariableQueryType.DimensionKeys:
          return this.handleDimensionKeysQuery(query);
        case VariableQueryType.DimensionValues:
          return this.handleDimensionValuesQuery(query);
        case VariableQueryType.EBSVolumeIDs:
          return this.handleEbsVolumeIdsQuery(query);
        case VariableQueryType.EC2InstanceAttributes:
          return this.handleEc2InstanceAttributeQuery(query);
        case VariableQueryType.ResourceArns:
          return this.handleResourceARNsQuery(query);
        case VariableQueryType.Statistics:
          return this.handleStatisticsQuery();
      }
    } catch (error) {
      console.error(`Could not run CloudWatchMetricFindQuery ${query}`, error);
      return [];
    }
  }

  async handleRegionsQuery() {
    const regions = await this.datasource.getRegions();
    return regions.map((s: { label: string; value: string }) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleNamespacesQuery() {
    const namespaces = await this.datasource.getNamespaces();
    return namespaces.map((s: { label: string; value: string }) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleMetricsQuery({ namespace, region }: VariableQuery) {
    const metrics = await this.datasource.getMetrics(namespace, region);
    return metrics.map((s: { label: string; value: string }) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleDimensionKeysQuery({ namespace, region }: VariableQuery) {
    const keys = await this.datasource.getDimensionKeys(namespace, region);
    return keys.map((s: { label: string; value: string }) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleDimensionValuesQuery({ namespace, region, dimensionKey, metricName, dimensionFilters }: VariableQuery) {
    if (!dimensionKey || !metricName) {
      return [];
    }
    const keys = await this.datasource.getDimensionValues(
      region,
      namespace,
      metricName,
      dimensionKey,
      dimensionFilters ?? {}
    );
    return keys.map((s: { label: string; value: string }) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleEbsVolumeIdsQuery({ region, instanceID }: VariableQuery) {
    if (!instanceID) {
      return [];
    }
    const ids = await this.datasource.getEbsVolumeIds(region, instanceID);
    return ids.map((s: { label: string; value: string }) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleEc2InstanceAttributeQuery({ region, attributeName, ec2Filters }: VariableQuery) {
    if (!attributeName) {
      return [];
    }
    let filterJson = {};
    if (ec2Filters) {
      filterJson = JSON.parse(ec2Filters);
    }
    const values = await this.datasource.getEc2InstanceAttribute(region, attributeName, filterJson);
    return values.map((s: { label: string; value: string }) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleResourceARNsQuery({ region, resourceType, tags }: VariableQuery) {
    if (!resourceType) {
      return [];
    }
    let tagJson = {};
    if (tags) {
      tagJson = JSON.parse(tags);
    }
    const keys = await this.datasource.getResourceARNs(region, resourceType, tagJson);
    return keys.map((s: { label: string; value: string }) => ({
      text: s.label,
      value: s.value,
      expandable: true,
    }));
  }

  async handleStatisticsQuery() {
    return this.datasource.standardStatistics.map((s: string) => ({
      text: s,
      value: s,
      expandable: true,
    }));
  }
}
