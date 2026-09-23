import React from 'react';
import {ScrollView, Text, Alert} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import api, {errorMessage} from '../api/axios';
import {Product} from '../models/Product';
import {useCartStore} from '../store/cartStore';
import {useAppStore} from '../store/appStore';
import {useFeatureStyles} from '../theme/features';
import PrimaryButton from '../components/common/PrimaryButton';
import EmptyState from '../components/common/EmptyState';
import Loader from '../components/common/Loader';
export default function SharedBasketScreen({route,navigation}:NativeStackScreenProps<RootStackParamList,'SharedBasket'>) {
  const s=useFeatureStyles(); const id=route.params.id;
  const valid=/^[A-Za-z0-9_-]{32}$/.test(id);
  const query=useQuery({queryKey:['shared-basket',id],enabled:valid, retry:false,
    queryFn:async({signal})=>(await api.get<{pincode:string;items:{productId:string;quantity:number}[];products:Product[]}>(`/shares/${id}`,{signal})).data});
  if(!valid) return <EmptyState message="Invalid basket link." />;
  if(query.isPending) return <Loader />;
  if(query.isError) return <EmptyState message={errorMessage(query.error)} onRetry={()=>{void query.refetch();}} />;
  const data=query.data;
  const items=data.items.flatMap(i=>{const product=data.products.find(p=>p.id===i.productId);return product?[{product,quantity:i.quantity}]:[];});
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <Text style={s.title}>Shared basket</Text><Text style={s.text}>Delivery pincode: {data.pincode}. Fresh prices and serviceability are checked when comparing.</Text>
    {items.map(i=><Text key={i.product.id} style={s.text}>{i.product.name} · {i.product.quantity} × {i.quantity}</Text>)}
    {items.length!==data.items.length?<Text style={s.text}>Some products are no longer available and will be omitted.</Text>:null}
    <PrimaryButton title="Use this basket" disabled={!items.length} onPress={()=>Alert.alert('Replace your basket?', 'This replaces your current items and delivery pincode.', [{text:'Cancel',style:'cancel'},{text:'Use basket',onPress:()=>{useCartStore.getState().loadCart(items);useAppStore.getState().setLocation(data.pincode);navigation.replace('Comparison');}}])} />
  </ScrollView>;
}
