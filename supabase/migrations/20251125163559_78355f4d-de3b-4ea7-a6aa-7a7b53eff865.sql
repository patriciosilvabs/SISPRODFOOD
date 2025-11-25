-- Add missing RLS policies for lojas_acesso
CREATE POLICY "Users can view their own lojas access" ON public.lojas_acesso
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage lojas access" ON public.lojas_acesso
  FOR ALL USING (public.is_admin(auth.uid()));

-- Add RLS policies for insumos_log
CREATE POLICY "Authenticated users can view insumos log" ON public.insumos_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Produção can insert insumos log" ON public.insumos_log
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'Admin') OR 
    public.has_role(auth.uid(), 'Produção')
  );

-- Add RLS policies for insumos_extras
CREATE POLICY "Authenticated users can view insumos extras" ON public.insumos_extras
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Produção can manage insumos extras" ON public.insumos_extras
  FOR ALL USING (
    public.has_role(auth.uid(), 'Admin') OR 
    public.has_role(auth.uid(), 'Produção')
  );

-- Add RLS policies for estoque_loja_itens
CREATE POLICY "Authenticated users can view estoque loja itens" ON public.estoque_loja_itens
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage estoque loja itens" ON public.estoque_loja_itens
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Loja users can update their own loja estoque" ON public.estoque_loja_itens
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'Loja') AND
    EXISTS (
      SELECT 1 FROM public.lojas_acesso
      WHERE user_id = auth.uid() AND loja_id = estoque_loja_itens.loja_id
    )
  );

-- Add RLS policies for estoque_cpd
CREATE POLICY "Authenticated users can view estoque CPD" ON public.estoque_cpd
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Produção can manage estoque CPD" ON public.estoque_cpd
  FOR ALL USING (
    public.has_role(auth.uid(), 'Admin') OR 
    public.has_role(auth.uid(), 'Produção')
  );